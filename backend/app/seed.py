"""
Seed script — creates demo admin + resident accounts and sample bins.
Run: python -m app.seed
"""

import random
from datetime import datetime, timedelta, timezone
from app.database import SessionLocal, engine, Base
from app import models
from app.auth import hash_password

Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        # Admin user
        if not db.query(models.User).filter(models.User.email == "admin@ecoroute.demo").first():
            admin = models.User(
                email="admin@ecoroute.demo",
                display_name="City Admin",
                hashed_password=hash_password("Admin1234!"),
                role=models.UserRole.administrator,
            )
            db.add(admin)

        # Resident user
        if not db.query(models.User).filter(models.User.email == "resident@ecoroute.demo").first():
            resident = models.User(
                email="resident@ecoroute.demo",
                display_name="Jane Resident",
                hashed_password=hash_password("Resident1234!"),
                role=models.UserRole.resident,
                wallet_address="0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
            )
            db.add(resident)
            db.flush()
            db.refresh(resident)

            # Sample submissions
            categories = [
                models.WasteCategory.plastics,
                models.WasteCategory.organics,
                models.WasteCategory.electronics,
            ]
            for i, cat in enumerate(categories):
                from app.token_service import get_token_amount
                amount = get_token_amount(cat)
                sub = models.SegregationSubmission(
                    resident_id=resident.id,
                    category=cat,
                    confidence_score=round(random.uniform(0.75, 0.97), 3),
                    tokens_awarded=amount,
                    reward_status=models.RewardStatus.completed,
                    tx_hash=f"0x{'a' * 64}",
                    created_at=datetime.now(timezone.utc) - timedelta(days=i),
                )
                db.add(sub)

        # Sample bins
        zones = ["north", "south", "east", "west", "central"]
        base_lat, base_lon = 40.7128, -74.0060  # NYC-ish
        for i in range(20):
            bin_id = f"BIN-{i+1:03d}"
            if not db.query(models.Bin).filter(models.Bin.id == bin_id).first():
                zone = zones[i % len(zones)]
                lat = base_lat + random.uniform(-0.05, 0.05)
                lon = base_lon + random.uniform(-0.05, 0.05)
                b = models.Bin(
                    id=bin_id,
                    latitude=round(lat, 6),
                    longitude=round(lon, 6),
                    zone_id=zone,
                    capacity_liters=random.choice([120, 240, 360]),
                )
                db.add(b)
                db.flush()

                # Historical fill records (14 days)
                for d in range(14):
                    fill = round(random.uniform(20, 95), 1)
                    fr = models.FillLevelRecord(
                        bin_id=bin_id,
                        fill_percentage=fill,
                        recorded_at=datetime.now(timezone.utc) - timedelta(days=d),
                    )
                    db.add(fr)

        db.commit()
        print("✅ Seed complete.")
        print("   Admin:    admin@ecoroute.demo / Admin1234!")
        print("   Resident: resident@ecoroute.demo / Resident1234!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
