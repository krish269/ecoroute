"""
Token service — bridges validated submissions to the GreenToken smart contract.

In MVP mode (no CONTRACT_ADDRESS configured): simulates minting and stores a
fake tx hash so the rest of the UI pipeline works.
"""

import asyncio
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app import models
from app.config import get_settings

settings = get_settings()

TOKEN_RATES = {
    models.WasteCategory.plastics: 10,
    models.WasteCategory.electronics: 25,
    models.WasteCategory.organics: 5,
}


def get_token_amount(category: models.WasteCategory) -> int:
    return TOKEN_RATES.get(category, 0)


async def process_reward(submission_id: str, db: Session) -> None:
    """Attempt to mint tokens for a validated submission."""
    submission = db.query(models.SegregationSubmission).filter(
        models.SegregationSubmission.id == submission_id
    ).first()
    if not submission:
        return

    if submission.category not in TOKEN_RATES:
        submission.reward_status = models.RewardStatus.not_applicable
        db.commit()
        return

    resident = db.query(models.User).filter(models.User.id == submission.resident_id).first()
    if not resident or not resident.wallet_address:
        submission.reward_status = models.RewardStatus.queued
        db.commit()
        return

    amount = get_token_amount(submission.category)
    await _mint_with_retry(submission, resident.wallet_address, amount, db)


async def _mint_with_retry(
    submission: models.SegregationSubmission,
    wallet: str,
    amount: int,
    db: Session,
    max_retries: int = 3,
) -> None:
    delay = 5.0
    for attempt in range(max_retries + 1):
        try:
            tx_hash = await _mint(wallet, amount, submission.id)
            submission.tx_hash = tx_hash
            submission.tokens_awarded = amount
            submission.reward_status = models.RewardStatus.completed
            db.commit()
            return
        except Exception as e:
            if attempt < max_retries:
                submission.reward_status = models.RewardStatus.retrying
                db.commit()
                await asyncio.sleep(delay)
                delay *= 2
            else:
                submission.reward_status = models.RewardStatus.failed
                db.commit()


async def _mint(wallet: str, amount: int, submission_id: str) -> str:
    """
    Calls the smart contract if configured; otherwise returns a simulated tx hash.
    """
    if settings.contract_address and settings.minter_private_key:
        return await _mint_on_chain(wallet, amount, submission_id)
    else:
        return _simulate_mint(wallet, amount, submission_id)


def _simulate_mint(wallet: str, amount: int, submission_id: str) -> str:
    """Deterministic fake tx hash for demo/MVP mode."""
    raw = f"{wallet}{amount}{submission_id}{time.time()}"
    return "0x" + hashlib.sha256(raw.encode()).hexdigest()


async def _mint_on_chain(wallet: str, amount: int, submission_id: str) -> str:
    """Real on-chain minting via Web3.py."""
    try:
        from web3 import Web3  # type: ignore

        w3 = Web3(Web3.HTTPProvider(settings.web3_rpc_url))
        if not w3.is_connected():
            raise ConnectionError("Cannot connect to RPC")

        # Minimal ABI for mint function
        abi = [
            {
                "inputs": [
                    {"name": "recipient", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                    {"name": "submissionId", "type": "string"},
                ],
                "name": "mint",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function",
            }
        ]
        contract = w3.eth.contract(address=settings.contract_address, abi=abi)
        account = w3.eth.account.from_key(settings.minter_private_key)
        nonce = w3.eth.get_transaction_count(account.address)

        tx = contract.functions.mint(wallet, amount, submission_id).build_transaction(
            {"from": account.address, "nonce": nonce, "gas": 200000}
        )
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return receipt.transactionHash.hex()
    except Exception as e:
        raise RuntimeError(f"On-chain minting failed: {e}") from e


async def flush_queued_rewards(user_id: str, db: Session) -> None:
    """Called when a resident links a wallet — processes any queued rewards."""
    queued = db.query(models.SegregationSubmission).filter(
        models.SegregationSubmission.resident_id == user_id,
        models.SegregationSubmission.reward_status == models.RewardStatus.queued,
    ).all()
    for submission in queued:
        await process_reward(submission.id, db)
