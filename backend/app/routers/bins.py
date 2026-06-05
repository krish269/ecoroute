import random
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app import models
from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/api/bins", tags=["bins"])


class BinCreateRequest(BaseModel):
    id: str
    latitude: float
    longitude: float
    zone_id: str
    capacity_liters: float

    @field_validator("id")
    @classmethod
    def id_length(cls, v: str) -> str:
        if len(v.strip()) < 1 or len(v) > 64:
            raise ValueError("id must be between 1 and 64 characters")
        return v.strip()

    @field_validator("latitude")
    @classmethod
    def lat_range(cls, v: float) -> float:
        if not (-90 <= v <= 90):
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def lon_range(cls, v: float) -> float:
        if not (-180 <= v <= 180):
            raise ValueError("longitude must be between -180 and 180")
        return v

    @field_validator("capacity_liters")
    @classmethod
    def capacity_range(cls, v: float) -> float:
        if not (1 <= v <= 100_000):
            raise ValueError("capacity_liters must be between 1 and 100,000")
        return v


class FillLevelRecord(BaseModel):
    bin_id: str
    fill_percentage: float
    recorded_at: datetime

    @field_validator("fill_percentage")
    @classmethod
    def fill_range(cls, v: float) -> float:
        if not (0 <= v <= 100):
            raise ValueError("fill_percentage must be between 0 and 100")
        return v


class BulkFillRequest(BaseModel):
    records: List[FillLevelRecord]


@router.post("/", status_code=201)
def register_bin(
    req: BinCreateRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    existing = db.query(models.Bin).filter(models.Bin.id == req.id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Bin '{req.id}' already exists")

    b = models.Bin(
        id=req.id,
        latitude=req.latitude,
        longitude=req.longitude,
        zone_id=req.zone_id,
        capacity_liters=req.capacity_liters,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id, "zone_id": b.zone_id, "latitude": b.latitude, "longitude": b.longitude}


@router.get("/")
def list_bins(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    bins = db.query(models.Bin).all()
    return [
        {
            "id": b.id,
            "latitude": b.latitude,
            "longitude": b.longitude,
            "zone_id": b.zone_id,
            "capacity_liters": b.capacity_liters,
            "is_active": b.is_active,
            "requires_collection": b.requires_collection,
            "predicted_fill_pct": b.predicted_fill_pct,
        }
        for b in bins
    ]


@router.post("/{bin_id}/fill", status_code=201)
def submit_fill_level(
    bin_id: str,
    record: FillLevelRecord,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    b = db.query(models.Bin).filter(models.Bin.id == bin_id).first()
    if not b:
        raise HTTPException(status_code=404, detail=f"Bin '{bin_id}' not found")

    # Validate timestamp not too far in future (24h)
    now = datetime.now(timezone.utc)
    ts = record.recorded_at.replace(tzinfo=timezone.utc) if record.recorded_at.tzinfo is None else record.recorded_at
    if (ts - now).total_seconds() > 86400:
        raise HTTPException(status_code=422, detail="Timestamp cannot be more than 24 hours in the future")

    fr = models.FillLevelRecord(
        bin_id=bin_id,
        fill_percentage=record.fill_percentage,
        recorded_at=ts,
    )
    db.add(fr)
    db.commit()
    return {"detail": "Fill level recorded"}


@router.post("/fill/bulk")
def bulk_fill_levels(
    req: BulkFillRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    if len(req.records) == 0 or len(req.records) > 1000:
        raise HTTPException(
            status_code=422,
            detail="Bulk request must contain between 1 and 1,000 records",
        )

    now = datetime.now(timezone.utc)
    accepted = []
    rejected = []

    for r in req.records:
        b = db.query(models.Bin).filter(models.Bin.id == r.bin_id).first()
        if not b:
            rejected.append({"bin_id": r.bin_id, "reason": "Bin not found"})
            continue
        ts = r.recorded_at.replace(tzinfo=timezone.utc) if r.recorded_at.tzinfo is None else r.recorded_at
        if (ts - now).total_seconds() > 86400:
            rejected.append({"bin_id": r.bin_id, "reason": "Timestamp too far in future"})
            continue
        fr = models.FillLevelRecord(
            bin_id=r.bin_id,
            fill_percentage=r.fill_percentage,
            recorded_at=ts,
        )
        db.add(fr)
        accepted.append(r.bin_id)

    db.commit()
    return {"accepted": len(accepted), "rejected": rejected}


# ---------------------------------------------------------------------------
# Sensor simulation — demo / hackathon helper
# ---------------------------------------------------------------------------

# Realistic fill-rate profiles per zone (mean, std) in % per reading
_ZONE_PROFILES = {
    "central":  (12.0, 4.0),   # busy — fills fast
    "north":    (7.0,  3.0),
    "south":    (7.0,  3.0),
    "east":     (5.0,  2.5),
    "west":     (5.0,  2.5),
}
_DEFAULT_PROFILE = (6.0, 3.0)


@router.post("/simulate", status_code=200)
def simulate_sensor_readings(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Push one simulated fill-level reading for every active bin.

    Fill increments are sampled from a zone-specific normal distribution so
    high-traffic zones (central) fill faster.  Bins that are already at or
    near 100 % stay full — they need collection first.

    Returns a summary of what changed and which bins crossed the 70 % threshold.
    """
    bins = db.query(models.Bin).filter(models.Bin.is_active == True).all()
    if not bins:
        raise HTTPException(status_code=404, detail="No active bins found.")

    now = datetime.now(timezone.utc)
    newly_critical: list[str] = []
    results = []

    for b in bins:
        # Get the latest known fill for this bin
        latest = (
            db.query(models.FillLevelRecord)
            .filter(models.FillLevelRecord.bin_id == b.id)
            .order_by(models.FillLevelRecord.recorded_at.desc())
            .first()
        )
        current_fill = latest.fill_percentage if latest else random.uniform(10, 40)

        # If already collected (fill reset after collection) or nearly empty, start low
        if current_fill >= 98:
            new_fill = current_fill  # full — awaiting collection
        else:
            mean, std = _ZONE_PROFILES.get(b.zone_id, _DEFAULT_PROFILE)
            increment = max(0.0, random.gauss(mean, std))
            new_fill = min(100.0, current_fill + increment)

        was_critical = (current_fill >= 70)
        is_critical  = (new_fill >= 70)

        fr = models.FillLevelRecord(
            bin_id=b.id,
            fill_percentage=round(new_fill, 1),
            recorded_at=now,
        )
        db.add(fr)

        if is_critical and not was_critical:
            newly_critical.append(b.id)

        results.append({
            "bin_id": b.id,
            "zone": b.zone_id,
            "previous_fill": round(current_fill, 1),
            "new_fill": round(new_fill, 1),
            "needs_collection": is_critical,
        })

    db.commit()

    return {
        "readings_pushed": len(results),
        "newly_critical_bins": newly_critical,
        "summary": results,
    }
