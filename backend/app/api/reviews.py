from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import (
    StorySubmission, StoryReview, ReviewDecision,
    Lead, LeadStatus, StoryStatus, User
)
from app.schemas.all_schemas import StoryReviewSubmit, StoryReviewOut
from app.services.email_service import EmailService
from app.services.payment_service import PaymentService
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/reviews", tags=["Staff Editorial Reviews"])

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

    if payload.decision == ReviewDecision.NOT_ELIGIBLE and not (payload.feedback and payload.feedback.strip()):
        raise HTTPException(
            status_code=400,
            detail="A detailed feedback reason is required when marking a story as NOT ELIGIBLE."
        )

    now = datetime.now(timezone.utc)
    review = db.query(StoryReview).filter(StoryReview.story_id == story_id).first()

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

    if payload.decision == ReviewDecision.ELIGIBLE:
        story.status = StoryStatus.ELIGIBLE
        lead.status = LeadStatus.ELIGIBLE
        db.commit()
        db.refresh(story)

        # Generate payment link directly for the eligible story
        payment = PaymentService.generate_payment_link(
            db=db,
            lead=lead,
            story=story
        )
        # EmailService.send_payment_link is already called in generate_payment_link
    else:
        story.status = StoryStatus.NOT_ELIGIBLE
        lead.status = LeadStatus.NOT_ELIGIBLE
        db.commit()
        db.refresh(story)

        # Dispatch review rejection feedback email
        try:
            EmailService.send_review_result(db=db, lead=lead, story=story, review=review)
        except Exception as e:
            pass

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
