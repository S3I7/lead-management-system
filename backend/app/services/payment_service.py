import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.entities import (
    Lead, LeadStatus, StorySubmission, StoryStatus,
    Payment, PaymentStatus, Publication, PublicationStatus
)
from app.services.email_service import EmailService
from app.core.config import settings

class PaymentService:
    @staticmethod
    def generate_payment_link(
        db: Session,
        lead: Lead,
        story: StorySubmission,
        amount: Optional[float] = None,
        gateway: str = "RAZORPAY"
    ) -> Payment:
        # Check eligibility: payment is available only when story is ELIGIBLE
        if story.status != StoryStatus.ELIGIBLE:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot generate payment link. Story status must be ELIGIBLE (current: {story.status.value})."
            )

        # Check existing active or paid payment
        existing_payment = db.query(Payment).filter(
            Payment.lead_id == lead.id,
            Payment.status == PaymentStatus.PAID
        ).first()
        if existing_payment:
            raise HTTPException(status_code=400, detail="Payment has already been completed for this story.")

        final_amount = amount if amount is not None else float(lead.writathon.submission_fee or 499.00)
        currency = lead.writathon.currency or "INR"
        token = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        payment_link = f"{settings.FRONTEND_URL}/payment/{token}"

        # If previous pending payment exists, reuse/update it
        payment = db.query(Payment).filter(
            Payment.lead_id == lead.id,
            Payment.status.in_([PaymentStatus.LINK_SENT, PaymentStatus.PENDING])
        ).first()

        if not payment:
            payment = Payment(
                lead_id=lead.id,
                story_id=story.id,
                gateway=gateway,
                gateway_payment_id=f"order_{uuid.uuid4().hex[:12]}",
                amount=final_amount,
                currency=currency,
                status=PaymentStatus.LINK_SENT,
                payment_link=payment_link,
                payment_link_token=token,
                link_expires_at=expires_at
            )
            db.add(payment)
        else:
            payment.payment_link = payment_link
            payment.payment_link_token = token
            payment.link_expires_at = expires_at
            payment.amount = final_amount
            payment.status = PaymentStatus.LINK_SENT

        # Lead status becomes PAYMENT_PENDING
        lead.status = LeadStatus.PAYMENT_PENDING
        db.commit()
        db.refresh(payment)

        # Send payment email
        EmailService.send_payment_link(db=db, lead=lead, payment=payment)

        return payment

    @staticmethod
    def process_webhook_or_verification(
        db: Session,
        payment_token: str,
        gateway_payment_id: str,
        is_successful: bool = True
    ) -> Payment:
        payment = db.query(Payment).filter(Payment.payment_link_token == payment_token).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record with the provided token not found.")

        if payment.status == PaymentStatus.PAID:
            return payment  # Idempotent response

        now = datetime.now(timezone.utc)
        if not is_successful:
            payment.status = PaymentStatus.FAILED
            db.commit()
            db.refresh(payment)
            return payment

        # Transition states strictly according to Step 5 / Section 24:
        # Lead Status = COMPLETED
        # Payment Status = PAID
        # Story Status = APPROVED
        # Publication Status = READY
        payment.status = PaymentStatus.PAID
        payment.gateway_payment_id = gateway_payment_id
        payment.paid_at = now

        lead = payment.lead
        story = payment.story

        lead.status = LeadStatus.COMPLETED
        story.status = StoryStatus.APPROVED

        # Check or create Publication entity
        publication = db.query(Publication).filter(Publication.story_id == story.id).first()
        if not publication:
            publication = Publication(
                story_id=story.id,
                publication_status=PublicationStatus.READY,
                publication_notes="Payment verified. Story queued for publication layout."
            )
            db.add(publication)
        else:
            publication.publication_status = PublicationStatus.READY

        db.commit()
        db.refresh(payment)

        # Send Payment Confirmation email & Final Confirmation email
        EmailService.send_payment_confirmation(db=db, lead=lead, story=story, payment=payment)
        EmailService.send_final_confirmation(db=db, lead=lead, story=story)

        return payment
