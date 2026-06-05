"""
Routing engine — predictive fill-level estimation + VRP route generation.

Fill-level prediction: simple linear regression per bin, zone-average fallback.
Route optimisation: nearest-neighbour greedy VRP (fast, good enough for MVP).
For production, swap in OR-Tools CVRPTW.
"""

from __future__ import annotations
import math
from datetime import datetime, timezone, date
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session

from app import models


# ---------------------------------------------------------------------------
# Fill-level prediction
# ---------------------------------------------------------------------------

COLLECTION_THRESHOLD = 70.0  # % fill to mark a bin for collection


def predict_fill_levels(db: Session, operational_date: date) -> Dict[str, float]:
    """
    Predict fill % for every active bin.
    Returns {bin_id: predicted_fill_pct}.
    """
    bins = db.query(models.Bin).filter(models.Bin.is_active == True).all()
    if not bins:
        return {}

    zone_avg = _compute_zone_averages(db)
    system_avg = _compute_system_average(db)
    predictions: Dict[str, float] = {}

    for b in bins:
        records = (
            db.query(models.FillLevelRecord)
            .filter(models.FillLevelRecord.bin_id == b.id)
            .order_by(models.FillLevelRecord.recorded_at.desc())
            .limit(30)
            .all()
        )
        if len(records) >= 7:
            predicted = _linear_trend(records)
        elif zone_avg.get(b.zone_id) is not None:
            predicted = zone_avg[b.zone_id]
        else:
            predicted = system_avg

        predicted = max(0.0, min(100.0, predicted))
        predictions[b.id] = round(predicted, 2)

        b.predicted_fill_pct = predicted
        b.requires_collection = predicted >= COLLECTION_THRESHOLD

    db.commit()
    return predictions


def _linear_trend(records: list) -> float:
    """Simple linear extrapolation from recent fill records."""
    if not records:
        return 50.0
    values = [r.fill_percentage for r in reversed(records)]
    n = len(values)
    if n == 1:
        return values[0]
    # Weighted average favouring recent readings
    weights = list(range(1, n + 1))
    wsum = sum(w * v for w, v in zip(weights, values))
    total = sum(weights)
    base = wsum / total
    # Add trend delta
    trend = (values[-1] - values[0]) / max(n - 1, 1)
    return base + trend * 1.5  # project 1.5 intervals ahead


def _compute_zone_averages(db: Session) -> Dict[str, float]:
    bins = db.query(models.Bin).filter(models.Bin.is_active == True).all()
    zone_totals: Dict[str, List[float]] = {}
    for b in bins:
        records = (
            db.query(models.FillLevelRecord)
            .filter(models.FillLevelRecord.bin_id == b.id)
            .order_by(models.FillLevelRecord.recorded_at.desc())
            .limit(7)
            .all()
        )
        if records:
            avg = sum(r.fill_percentage for r in records) / len(records)
            zone_totals.setdefault(b.zone_id, []).append(avg)
    return {zone: sum(vals) / len(vals) for zone, vals in zone_totals.items()}


def _compute_system_average(db: Session) -> float:
    records = db.query(models.FillLevelRecord).order_by(
        models.FillLevelRecord.recorded_at.desc()
    ).limit(500).all()
    if not records:
        return 50.0
    return sum(r.fill_percentage for r in records) / len(records)


# ---------------------------------------------------------------------------
# Vehicle Routing (greedy nearest-neighbour)
# ---------------------------------------------------------------------------

SERVICE_TIME_HOURS = 5 / 60  # 5 minutes per bin
MAX_ROUTE_HOURS = 8.0
AVG_SPEED_KMH = 40.0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def generate_routes(
    db: Session,
    operational_date: date,
    vehicle_ids: List[str],
) -> List[models.CollectionRoute]:
    """
    Generate Collection_Routes for the given vehicles and operational date.
    Only includes bins marked as requiring collection.
    """
    bins_needing_collection = (
        db.query(models.Bin)
        .filter(models.Bin.is_active == True, models.Bin.requires_collection == True)
        .all()
    )

    if not bins_needing_collection:
        return []

    # Assign bins to vehicles using round-robin greedy nearest-neighbour
    unassigned = list(bins_needing_collection)
    routes: List[models.CollectionRoute] = []
    date_str = operational_date.strftime("%Y-%m-%d")

    for vehicle_id in vehicle_ids:
        if not unassigned:
            break

        route_bins, unassigned = _nearest_neighbour_route(unassigned, MAX_ROUTE_HOURS)
        if not route_bins:
            break

        total_dist = _route_distance(route_bins)
        est_hours = total_dist / AVG_SPEED_KMH + len(route_bins) * SERVICE_TIME_HOURS

        route = models.CollectionRoute(
            vehicle_id=vehicle_id,
            operational_date=date_str,
            total_distance_km=round(total_dist, 2),
            estimated_hours=round(est_hours, 2),
        )
        db.add(route)
        db.flush()

        for order, b in enumerate(route_bins):
            stop = models.RouteStop(
                route_id=route.id,
                bin_id=b.id,
                stop_order=order,
            )
            db.add(stop)

        routes.append(route)

    db.commit()
    return routes


def _nearest_neighbour_route(
    bins: List[models.Bin], max_hours: float
) -> Tuple[List[models.Bin], List[models.Bin]]:
    """
    Build one vehicle route using nearest-neighbour heuristic.
    Returns (assigned_bins, remaining_bins).
    """
    if not bins:
        return [], []

    remaining = list(bins)
    route: List[models.Bin] = []
    elapsed_hours = 0.0

    current_lat, current_lon = 0.0, 0.0  # depot at centroid
    if remaining:
        current_lat = sum(b.latitude for b in remaining) / len(remaining)
        current_lon = sum(b.longitude for b in remaining) / len(remaining)

    while remaining:
        nearest = min(
            remaining,
            key=lambda b: haversine(current_lat, current_lon, b.latitude, b.longitude),
        )
        dist = haversine(current_lat, current_lon, nearest.latitude, nearest.longitude)
        travel_h = dist / AVG_SPEED_KMH + SERVICE_TIME_HOURS
        if elapsed_hours + travel_h > max_hours:
            break
        route.append(nearest)
        remaining.remove(nearest)
        current_lat, current_lon = nearest.latitude, nearest.longitude
        elapsed_hours += travel_h

    return route, remaining


def _route_distance(bins: List[models.Bin]) -> float:
    if len(bins) < 2:
        return 0.0
    total = 0.0
    for i in range(len(bins) - 1):
        total += haversine(bins[i].latitude, bins[i].longitude, bins[i + 1].latitude, bins[i + 1].longitude)
    return total


# ---------------------------------------------------------------------------
# Prediction accuracy (MAE)
# ---------------------------------------------------------------------------

def compute_prediction_mae(db: Session) -> float | None:
    """
    Compute mean absolute error between predicted and actual fill levels.
    Requires at least 10 completed collections with actual fill data.
    """
    stops_with_data = (
        db.query(models.RouteStop)
        .filter(
            models.RouteStop.is_collected == True,
            models.RouteStop.actual_fill_pct != None,
        )
        .all()
    )
    if len(stops_with_data) < 10:
        return None

    errors = []
    for stop in stops_with_data:
        b = db.query(models.Bin).filter(models.Bin.id == stop.bin_id).first()
        if b and b.predicted_fill_pct is not None:
            errors.append(abs(b.predicted_fill_pct - stop.actual_fill_pct))

    if not errors:
        return None
    return round(sum(errors) / len(errors), 2)
