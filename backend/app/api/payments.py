import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import (
    Lead, LeadStatus, StorySubmission, StoryStatus,
    Payment, PaymentStatus, Publication, PublicationStatus, User
)
from app.schemas.all_schemas import (
    PaymentOut, PaymentGenerateRequest, PaymentProcessRequest, PaymentWebhookPayload
)
from app.services.payment_service import PaymentService
from app.services.email_service import EmailService
from app.api.deps import require_staff_or_admin
from app.core.config import settings

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.post("/generate/{lead_id}", response_model=PaymentOut)
def generate_payment_link(
    lead_id: int,
    payload: PaymentGenerateRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff_or_admin)
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    story = db.query(StorySubmission).filter(StorySubmission.lead_id == lead.id).first()
    if not story:
        raise HTTPException(status_code=400, detail="Lead has not submitted any story yet.")

    return PaymentService.generate_payment_link(
        db=db,
        lead=lead,
        story=story,
        amount=payload.amount,
        gateway=payload.gateway or "RAZORPAY"
    )

@router.get("/by-token/{token}", response_model=PaymentOut)
def get_payment_by_token(token: str, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.payment_link_token == token).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment link is invalid or expired.")
    return payment

@router.post("/process-checkout/{token}", response_model=PaymentOut)
def process_checkout(
    token: str,
    payload: PaymentProcessRequest,
    db: Session = Depends(get_db)
):
    """
    Simulates frontend payment gateway submission (Razorpay/Stripe checkout),
    which immediately delegates to the server-side verification/webhook logic.
    Demo only: in production the gateway confirms payment through /webhook.
    """
    if not settings.DEMO_MODE:
        raise HTTPException(status_code=403, detail="Payments are confirmed by the payment gateway only.")
    payment = db.query(Payment).filter(Payment.payment_link_token == token).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")

    if payment.status == PaymentStatus.PAID:
        return payment

    # Generate gateway transaction reference
    gateway_txn_id = payload.transaction_ref or f"pay_{uuid.uuid4().hex[:14]}"
    
    # Secure server-side verification logic
    return PaymentService.process_webhook_or_verification(
        db=db,
        payment_token=token,
        gateway_payment_id=gateway_txn_id,
        is_successful=payload.mock_success
    )

@router.post("/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Server-side webhook for payment gateways. The body must be signed:
    header X-Webhook-Signature = hex HMAC-SHA256(raw body, PAYMENT_WEBHOOK_SECRET).
    """
    # shortcut: generic signed payload, not Razorpay's/Stripe's native event format; adapt when wiring the real gateway
    if not settings.PAYMENT_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Payment webhook is not configured.")
    raw = await request.body()
    expected = hmac.new(settings.PAYMENT_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("X-Webhook-Signature", "")):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")
    payload = PaymentWebhookPayload.model_validate_json(raw)

    payment = db.query(Payment).filter(Payment.payment_link_token == payload.payment_link_token).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")
    is_success = payload.status.lower() in ["captured", "paid", "succeeded", "success"]
    if is_success and round(payload.amount, 2) != round(float(payment.amount), 2):
        raise HTTPException(status_code=400, detail="Paid amount does not match the payment amount.")

    payment = PaymentService.process_webhook_or_verification(
        db=db,
        payment_token=payload.payment_link_token,
        gateway_payment_id=payload.gateway_payment_id,
        is_successful=is_success
    )
    return {"status": "ok", "payment_status": payment.status.value}

@router.post("/send-reminder/{payment_id}")
def send_payment_reminder(
    payment_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff_or_admin)
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if payment.status == PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Payment has already been completed.")

    EmailService.send_payment_link(db=db, lead=payment.lead, payment=payment)
    return {"message": "Payment reminder dispatched successfully."}
