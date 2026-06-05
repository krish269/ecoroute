import asyncio
import hashlib
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image
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

# Perceptual hash similarity threshold (0 = identical, 10 = very similar)
PHASH_DUPLICATE_THRESHOLD = 8

# Approximate kg per category submission (for impact stats)
WEIGHT_KG_PER_CATEGORY = {
    models.WasteCategory.plastics: 0.5,
    models.WasteCategory.electronics: 1.2,
    models.WasteCategory.organics: 0.8,
}
CO2_FACTOR = 2.5


# ---------------------------------------------------------------------------
# Perceptual hashing — no extra library needed, pure Pillow + stdlib
# ---------------------------------------------------------------------------

def _phash(image_bytes: bytes, hash_size: int = 16) -> str:
    """
    Compute a perceptual hash (pHash) of an image.

    Algorithm:
    1. Resize to hash_size x hash_size in grayscale
    2. Compute DCT (approximated via row/col means)
    3. Compare each pixel to the median → 256-bit binary string → hex

    Returns a hex string. Two images are "the same" if their
    Hamming distance is below PHASH_DUPLICATE_THRESHOLD.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("L").resize(
        (hash_size, hash_size), Image.LANCZOS
    )
    pixels = list(img.getdata())
    avg = sum(pixels) / len(pixels)
    bits = "".join("1" if p >= avg else "0" for p in pixels)
    # Pack bits into hex
    hex_hash = hex(int(bits, 2))[2:].zfill(hash_size * hash_size // 4)
    return hex_hash


def _hamming_distance(h1: str, h2: str) -> int:
    """Bit-level Hamming distance between two hex hash strings."""
    # Convert hex → int → XOR → popcount
    try:
        return bin(int(h1, 16) ^ int(h2, 16)).count("1")
    except ValueError:
        return 999  # treat malformed hash as non-duplicate


def _find_duplicate(
    image_hash: str,
    resident_id: str,
    db: Session,
) -> models.SegregationSubmission | None:
    """
    Check if this resident already submitted a visually identical image.
    Looks at all their previous validated submissions.
    """
    previous = (
        db.query(models.SegregationSubmission)
        .filter(
            models.SegregationSubmission.resident_id == resident_id,
            models.SegregationSubmission.image_hash.isnot(None),
            models.SegregationSubmission.category.in_([
                models.WasteCategory.plastics,
                models.WasteCategory.electronics,
                models.WasteCategory.organics,
            ]),
        )
        .all()
    )
    for sub in previous:
        if _hamming_distance(image_hash, sub.image_hash) <= PHASH_DUPLICATE_THRESHOLD:
            return sub
    return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

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

    # --- Duplicate detection BEFORE hitting the AI model ---
    try:
        image_hash = _phash(image_bytes)
    except Exception:
        image_hash = hashlib.md5(image_bytes).hexdigest()  # fallback to MD5

    duplicate = _find_duplicate(image_hash, current_user.id, db)
    if duplicate:
        return {
            "result": "duplicate",
            "category": duplicate.category,
            "confidence_score": duplicate.confidence_score,
            "tokens_awarded": 0,
            "message": (
                f"This image has already been submitted "
                f"(submission {duplicate.id[:8]}…). "
                "Each waste item can only be claimed once."
            ),
            "submission_id": None,
            "original_submission_id": duplicate.id,
        }

    # Classify with AI
    try:
        category_str, confidence = classify_image(image_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=504, detail=f"Vision model timeout or error: {e}")

    category = models.WasteCategory(category_str)

    # Uncertain
    if confidence < CONFIDENCE_THRESHOLD:
        return {
            "result": "uncertain",
            "category": category_str,
            "confidence_score": confidence,
            "tokens_awarded": 0,
            "message": "Confidence too low. Please retake the photo with better lighting.",
            "submission_id": None,
        }

    # Non-segregated
    if category == models.WasteCategory.non_segregated:
        return {
            "result": "rejected",
            "category": category_str,
            "confidence_score": confidence,
            "tokens_awarded": 0,
            "message": "Waste does not appear to be properly segregated.",
            "submission_id": None,
        }

    # Valid — create submission with hash stored
    token_amount = get_token_amount(category)
    submission = models.SegregationSubmission(
        resident_id=current_user.id,
        category=category,
        confidence_score=confidence,
        tokens_awarded=token_amount,
        reward_status=models.RewardStatus.pending,
        image_filename=file.filename,
        image_hash=image_hash,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

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
    total_weight_kg = sum(WEIGHT_KG_PER_CATEGORY.get(s.category, 0) for s in submissions)
    co2_saved_kg = round(total_weight_kg * CO2_FACTOR, 2)

    return {
        "total_submissions": len(submissions),
        "total_tokens_earned": total_tokens,
        "total_weight_kg": round(total_weight_kg, 2),
        "co2_saved_kg": co2_saved_kg,
    }
