from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
import logging
from app.models.entities import (
    StorySubmission, StoryReview, ReviewDecision, PlagiarismStatus, Payment, PaymentStatus,
    Lead, LeadStatus, StoryStatus, User
)
from app.core.audit import audit
from app.schemas.all_schemas import StoryReviewSubmit, StoryReviewOut
from app.services.email_service import EmailService
from app.services.payment_service import PaymentService
from app.api.deps import require_staff_or_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reviews", tags=["Staff Editorial Reviews"])
LOCKED = (StoryStatus.APPROVED, StoryStatus.PUBLISHED)  # payment completed

@router.post("/{story_id}", response_model=StoryReviewOut)
def record_staff_review(
    story_id: int,
    payload: StoryReviewSubmit,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_staff_or_admin)
):
    story = db.query(StorySubmission).filter(StorySubmission.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story submission not found.")

    if story.status in LOCKED:
        raise HTTPException(status_code=409, detail="Payment for this story is complete; the review decision is locked.")
    plag = story.plagiarism_review
    if not plag or plag.status == PlagiarismStatus.NOT_CHECKED:
        raise HTTPException(status_code=400, detail="Record the manual plagiarism check before the eligibility decision.")
    if payload.decision == ReviewDecision.ELIGIBLE and plag.status != PlagiarismStatus.PASS:
        raise HTTPException(status_code=400, detail="A story flagged in the plagiarism check cannot be marked ELIGIBLE.")
    if payload.decision == ReviewDecision.NOT_ELIGIBLE and not (payload.feedback and payload.feedback.strip()):
        raise HTTPException(
            status_code=400,
            detail="A detailed feedback reason is required when marking a story as NOT ELIGIBLE."
        )

    now = datetime.now(timezone.utc)
    review = db.query(StoryReview).filter(StoryReview.story_id == story_id).first()
    previous = review.decision if review else None
    audit(db, reviewer, "review.decision", "story_submission", story.id,
          {"decision": [previous, payload.decision], "previous_reviewer_id": review.reviewer_id if review else None})

    if not review:
        review = StoryReview(
            story_id=story_id,
            reviewer_id=reviewer.id,
            decision=payload.decision,
            feedback=payload.feedback,
            internal_notes=payload.internal_notes,
            reviewed_at=now
        )
        db.add(review)
    else:
        review.reviewer_id = reviewer.id
        review.decision = payload.decision
        review.feedback = payload.feedback
        review.internal_notes = payload.internal_notes
        review.reviewed_at = now

    lead = story.lead

    if payload.decision == previous:
        # Same decision again: only feedback/notes change; no new payment link or email to the parent
        db.commit()
    elif payload.decision == ReviewDecision.ELIGIBLE:
        story.status = StoryStatus.ELIGIBLE
        lead.status = LeadStatus.ELIGIBLE
        db.commit()
        db.refresh(story)
        # Creates the payment link, moves the lead to PAYMENT_PENDING and emails the parent
        PaymentService.generate_payment_link(db=db, lead=lead, story=story)
    else:
        story.status = StoryStatus.NOT_ELIGIBLE
        lead.status = LeadStatus.NOT_ELIGIBLE
        # A decision reversed before payment: the parent must no longer be able to pay
        for p in db.query(Payment).filter(Payment.story_id == story.id, Payment.status.in_(
                [PaymentStatus.LINK_SENT, PaymentStatus.PENDING, PaymentStatus.FAILED])):
            audit(db, reviewer, "payment.expire", "payment", p.id, {"status": [p.status, PaymentStatus.EXPIRED]})
            p.status = PaymentStatus.EXPIRED
        db.commit()
        db.refresh(story)
        try:
            EmailService.send_review_result(db=db, lead=lead, story=story, review=review)
        except Exception:
            logger.exception("Review result email failed for story %s", story.id)
            db.rollback()

    db.refresh(review)

    return {
        "id": review.id,
        "story_id": review.story_id,
        "reviewer_id": review.reviewer_id,
        "reviewer_name": reviewer.full_name,
        "decision": review.decision,
        "feedback": review.feedback,
        "internal_notes": review.internal_notes,
        "reviewed_at": review.reviewed_at,
        "created_at": review.created_at
    }
