from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import (
    StorySubmission, ManualPlagiarismReview, PlagiarismStatus,
    Lead, LeadStatus, StoryStatus, User
)
from app.schemas.all_schemas import PlagiarismReviewSubmit, PlagiarismReviewOut
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/plagiarism", tags=["Manual Plagiarism Review"])

@router.post("/{story_id}", response_model=PlagiarismReviewOut)
def record_manual_plagiarism_check(
    story_id: int,
    payload: PlagiarismReviewSubmit,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_staff_or_admin)
):
    """
    STRICT REQUIREMENT: NO AI PLAGIARISM CHECK.
    Records manual assessment performed by human reviewer.
    """
    story = db.query(StorySubmission).filter(StorySubmission.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story submission not found.")

    review = db.query(ManualPlagiarismReview).filter(ManualPlagiarismReview.story_id == story_id).first()
    now = datetime.now(timezone.utc)

    if not review:
        review = ManualPlagiarismReview(
            story_id=story_id,
            reviewer_id=reviewer.id,
            status=payload.status,
            plagiarism_notes=payload.plagiarism_notes,
            reference_sources=payload.reference_sources,
            checked_at=now
        )
        db.add(review)
    else:
        review.reviewer_id = reviewer.id
        review.status = payload.status
        review.plagiarism_notes = payload.plagiarism_notes
        review.reference_sources = payload.reference_sources
        review.checked_at = now

    # If lead was at STORY_SUBMITTED, advance to UNDER_REVIEW
    lead = story.lead
    if lead and lead.status == LeadStatus.STORY_SUBMITTED:
        lead.status = LeadStatus.UNDER_REVIEW

    db.commit()
    db.refresh(review)

    return {
        "id": review.id,
        "story_id": review.story_id,
        "reviewer_id": review.reviewer_id,
        "reviewer_name": reviewer.full_name,
        "status": review.status,
        "plagiarism_notes": review.plagiarism_notes,
        "reference_sources": review.reference_sources,
        "checked_at": review.checked_at,
        "created_at": review.created_at
    }
