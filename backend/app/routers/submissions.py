import asyncio
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db
from app.vision import classify_image
from app.token_service import process_reward, get_token_amount

router = APIRouter(prefix="/api/submissions", tags=["submissions"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}
CONFIDENCE_THRESHOLD = 0.70

# Approximate kg per category submission (for impact stats)
WEIGHT_KG_PER_CATEGORY = {
    models.WasteCategory.plastics: 0.5,
    models.WasteCategory.electronics: 1.2,
    models.WasteCategory.organics: 0.8,
}

# kg CO2 saved per kg of waste diverted from landfill
CO2_FACTOR = 2.5


@router.post("/", status_code=201)
async def create_submission(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Invalid file type. Only JPEG and PNG images are accepted.",
        )

    image_bytes = await file.read()

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail="File size exceeds 10 MB limit.",
        )

    # Classify
    try:
        category_str, confidence = classify_image(image_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=504, detail=f"Vision model timeout or error: {e}")

    category = models.WasteCategory(category_str)

    # Uncertain result — do not create submission
    if confidence < CONFIDENCE_THRESHOLD:
        return {
            "result": "uncertain",
            "category": category_str,
            "confidence_score": confidence,
            "message": "Confidence too low. Please retake the photo with better lighting.",
            "submission_id": None,
        }

    # Non-segregated — do not create submission
    if category == models.WasteCategory.non_segregated:
        return {
            "result": "rejected",
            "category": category_str,
            "confidence_score": confidence,
            "message": "Waste does not appear to be properly segregated.",
            "submission_id": None,
        }

    # Valid — create submission
    token_amount = get_token_amount(category)
    submission = models.SegregationSubmission(
        resident_id=current_user.id,
        category=category,
        confidence_score=confidence,
        tokens_awarded=token_amount,
        reward_status=models.RewardStatus.pending,
        image_filename=file.filename,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Kick off token minting async
    asyncio.create_task(process_reward(submission.id, db))

    return {
        "result": "validated",
        "category": category_str,
        "confidence_score": confidence,
        "tokens_awarded": token_amount,
        "submission_id": submission.id,
        "reward_status": submission.reward_status,
    }


@router.get("/")
def list_submissions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submissions = (
        db.query(models.SegregationSubmission)
        .filter(models.SegregationSubmission.resident_id == current_user.id)
        .order_by(models.SegregationSubmission.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "category": s.category,
            "confidence_score": s.confidence_score,
            "tokens_awarded": s.tokens_awarded,
            "reward_status": s.reward_status,
            "tx_hash": s.tx_hash,
            "created_at": s.created_at,
        }
        for s in submissions
    ]


@router.get("/impact")
def get_impact(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compute citizen's environmental impact stats."""
    submissions = (
        db.query(models.SegregationSubmission)
        .filter(
            models.SegregationSubmission.resident_id == current_user.id,
            models.SegregationSubmission.category.in_([
                models.WasteCategory.plastics,
                models.WasteCategory.electronics,
                models.WasteCategory.organics,
            ]),
        )
        .all()
    )

    total_tokens = sum(s.tokens_awarded for s in submissions)
    total_weight_kg = sum(
        WEIGHT_KG_PER_CATEGORY.get(s.category, 0) for s in submissions
    )
    co2_saved_kg = round(total_weight_kg * CO2_FACTOR, 2)

    return {
        "total_submissions": len(submissions),
        "total_tokens_earned": total_tokens,
        "total_weight_kg": round(total_weight_kg, 2),
        "co2_saved_kg": co2_saved_kg,
    }
