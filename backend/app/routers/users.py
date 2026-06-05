from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import asyncio

from app import models
from app.auth import get_current_user
from app.database import get_db
from app.token_service import flush_queued_rewards

router = APIRouter(prefix="/api/users", tags=["users"])


def _validate_wallet(address: str) -> bool:
    """Minimal EIP-55 format check: 0x + 40 hex chars."""
    if not address.startswith("0x") or len(address) != 42:
        return False
    try:
        int(address[2:], 16)
    except ValueError:
        return False
    return True


class WalletUpdateRequest(BaseModel):
    wallet_address: str


@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
        "wallet_address": current_user.wallet_address,
        "created_at": current_user.created_at,
    }


@router.put("/me/wallet")
def update_wallet(
    req: WalletUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _validate_wallet(req.wallet_address):
        raise HTTPException(
            status_code=422,
            detail="Invalid wallet address: must conform to EIP-55 checksum format (0x + 40 hex chars)",
        )
    current_user.wallet_address = req.wallet_address
    db.commit()

    # Flush any queued token rewards
    asyncio.create_task(flush_queued_rewards(current_user.id, db))

    return {"wallet_address": current_user.wallet_address}
