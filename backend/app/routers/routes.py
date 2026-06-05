from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_admin
from app.database import get_db
from app.routing import generate_routes, predict_fill_levels, compute_prediction_mae

router = APIRouter(prefix="/api/routes", tags=["routes"])


class GenerateRoutesRequest(BaseModel):
    operational_date: date
    vehicle_ids: List[str]


class MarkCollectedRequest(BaseModel):
    actual_fill_pct: float


@router.post("/predict")
def run_predictions(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Trigger fill-level prediction for all active bins."""
    from datetime import date as date_type
    predictions = predict_fill_levels(db, date_type.today())
    bins_needing = sum(1 for v in predictions.values() if v >= 70)
    return {
        "total_bins_predicted": len(predictions),
        "bins_needing_collection": bins_needing,
    }


@router.post("/generate", status_code=201)
def create_routes(
    req: GenerateRoutesRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Generate optimized collection routes."""
    if not req.vehicle_ids:
        raise HTTPException(status_code=422, detail="At least one vehicle_id required")

    routes = generate_routes(db, req.operational_date, req.vehicle_ids)
    return {
        "routes_created": len(routes),
        "routes": [
            {
                "id": r.id,
                "vehicle_id": r.vehicle_id,
                "operational_date": r.operational_date,
                "total_distance_km": r.total_distance_km,
                "estimated_hours": r.estimated_hours,
                "stop_count": len(r.stops),
            }
            for r in routes
        ],
    }


@router.get("/")
def list_routes(
    operational_date: str = None,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    query = db.query(models.CollectionRoute)
    if operational_date:
        query = query.filter(models.CollectionRoute.operational_date == operational_date)
    routes = query.all()
    return [
        {
            "id": r.id,
            "vehicle_id": r.vehicle_id,
            "operational_date": r.operational_date,
            "total_distance_km": r.total_distance_km,
            "estimated_hours": r.estimated_hours,
            "is_completed": r.is_completed,
            "stops": [
                {
                    "id": s.id,
                    "bin_id": s.bin_id,
                    "stop_order": s.stop_order,
                    "is_collected": s.is_collected,
                    "collected_at": s.collected_at,
                    "bin_lat": s.bin.latitude if s.bin else None,
                    "bin_lon": s.bin.longitude if s.bin else None,
                }
                for s in r.stops
            ],
        }
        for r in routes
    ]


@router.get("/today")
def get_today_routes(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    today = date.today().strftime("%Y-%m-%d")
    routes = db.query(models.CollectionRoute).filter(
        models.CollectionRoute.operational_date == today
    ).all()
    return [
        {
            "id": r.id,
            "vehicle_id": r.vehicle_id,
            "operational_date": r.operational_date,
            "total_distance_km": r.total_distance_km,
            "estimated_hours": r.estimated_hours,
            "is_completed": r.is_completed,
            "stops": [
                {
                    "id": s.id,
                    "bin_id": s.bin_id,
                    "stop_order": s.stop_order,
                    "is_collected": s.is_collected,
                    "collected_at": s.collected_at,
                    "bin_lat": s.bin.latitude if s.bin else None,
                    "bin_lon": s.bin.longitude if s.bin else None,
                }
                for s in r.stops
            ],
        }
        for r in routes
    ]


@router.post("/stops/{stop_id}/collect")
def mark_stop_collected(
    stop_id: str,
    req: MarkCollectedRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Fleet operator marks a bin stop as collected."""
    from datetime import datetime, timezone
    stop = db.query(models.RouteStop).filter(models.RouteStop.id == stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    if not (0 <= req.actual_fill_pct <= 100):
        raise HTTPException(status_code=422, detail="actual_fill_pct must be 0–100")

    stop.is_collected = True
    stop.collected_at = datetime.now(timezone.utc)
    stop.actual_fill_pct = req.actual_fill_pct

    # Check if whole route is complete
    route = stop.route
    if all(s.is_collected for s in route.stops):
        route.is_completed = True

    db.commit()
    return {"detail": "Stop marked as collected", "route_completed": route.is_completed}


@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """System-wide analytics for admin dashboard."""
    from datetime import datetime
    import calendar

    total_bins = db.query(models.Bin).count()

    now = datetime.now()
    first_day = datetime(now.year, now.month, 1).strftime("%Y-%m-%d")
    routes_this_month = db.query(models.CollectionRoute).filter(
        models.CollectionRoute.operational_date >= first_day,
        models.CollectionRoute.is_completed == True,
    ).count()

    # Total tokens minted (from DB records)
    from sqlalchemy import func
    total_tokens = db.query(func.sum(models.SegregationSubmission.tokens_awarded)).scalar() or 0

    mae = compute_prediction_mae(db)

    return {
        "total_bins_monitored": total_bins,
        "routes_completed_this_month": routes_this_month,
        "total_green_tokens_minted": total_tokens,
        "prediction_accuracy_mae": mae,
    }
