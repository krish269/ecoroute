from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Enum, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
import uuid

from app.database import Base


def new_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    resident = "resident"
    administrator = "administrator"


class RewardStatus(str, enum.Enum):
    pending = "pending"
    retrying = "retrying"
    completed = "completed"
    failed = "failed"
    not_applicable = "not_applicable"
    queued = "queued"


class WasteCategory(str, enum.Enum):
    plastics = "plastics"
    electronics = "electronics"
    organics = "organics"
    non_segregated = "non-segregated"
    uncertain = "uncertain"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.resident, nullable=False)
    wallet_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    submissions = relationship("SegregationSubmission", back_populates="resident")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="refresh_tokens")


class SegregationSubmission(Base):
    __tablename__ = "segregation_submissions"

    id = Column(String, primary_key=True, default=new_uuid)
    resident_id = Column(String, ForeignKey("users.id"), nullable=False)
    category = Column(Enum(WasteCategory), nullable=False)
    confidence_score = Column(Float, nullable=False)
    tokens_awarded = Column(Integer, default=0)
    reward_status = Column(Enum(RewardStatus), default=RewardStatus.pending)
    tx_hash = Column(String, nullable=True)
    image_filename = Column(String, nullable=True)
    image_hash = Column(String, nullable=True, index=True)  # perceptual hash for duplicate detection
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    resident = relationship("User", back_populates="submissions")


class Bin(Base):
    __tablename__ = "bins"

    id = Column(String, primary_key=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    zone_id = Column(String, nullable=False, index=True)
    capacity_liters = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    requires_collection = Column(Boolean, default=False)
    predicted_fill_pct = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    fill_records = relationship("FillLevelRecord", back_populates="bin")


class FillLevelRecord(Base):
    __tablename__ = "fill_level_records"

    id = Column(String, primary_key=True, default=new_uuid)
    bin_id = Column(String, ForeignKey("bins.id"), nullable=False)
    fill_percentage = Column(Float, nullable=False)
    recorded_at = Column(DateTime, nullable=False)
    actual_collection_fill = Column(Float, nullable=True)

    bin = relationship("Bin", back_populates="fill_records")


class CollectionRoute(Base):
    __tablename__ = "collection_routes"

    id = Column(String, primary_key=True, default=new_uuid)
    vehicle_id = Column(String, nullable=False)
    operational_date = Column(String, nullable=False)  # YYYY-MM-DD
    total_distance_km = Column(Float, nullable=True)
    estimated_hours = Column(Float, nullable=True)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    stops = relationship("RouteStop", back_populates="route", order_by="RouteStop.stop_order")


class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(String, primary_key=True, default=new_uuid)
    route_id = Column(String, ForeignKey("collection_routes.id"), nullable=False)
    bin_id = Column(String, ForeignKey("bins.id"), nullable=False)
    stop_order = Column(Integer, nullable=False)
    is_collected = Column(Boolean, default=False)
    collected_at = Column(DateTime, nullable=True)
    actual_fill_pct = Column(Float, nullable=True)

    route = relationship("CollectionRoute", back_populates="stops")
    bin = relationship("Bin")
