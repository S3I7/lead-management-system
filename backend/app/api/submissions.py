import logging
import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.core.database import get_db
from app.models.entities import (
    Lead, LeadStatus, StorySubmission, StoryStatus,
    ManualPlagiarismReview, PlagiarismStatus, WritathonStatus, Writathon
)
from app.schemas.all_schemas import StorySubmissionOut, SubmissionListItem
from app.api.deps import require_staff_or_admin
from app.core.audit import audit
from app.core.rate_limit import rate_limit
from app.services.storage_service import StorageService
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/submissions", tags=["Story Submissions"])

@router.post("", response_model=StorySubmissionOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit)])
def submit_story(
    lead_token: str = Form(...),
    title: str = Form(...),
    word_count: Optional[int] = Form(None),
    category: Optional[str] = Form(None),
    originality_declaration: bool = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not originality_declaration:
        raise HTTPException(status_code=400, detail="You must declare that the story is original work by the child.")
    title = title.strip()
    if not 1 <= len(title) <= 255:
        raise HTTPException(status_code=400, detail="Story title must be 1-255 characters.")
    if word_count is not None and not 0 < word_count <= 200000:
        raise HTTPException(status_code=400, detail="Word count must be a positive number.")
    if category is not None and len(category) > 100:
        raise HTTPException(status_code=400, detail="Category is too long.")

    # Authenticate lead
    lead = db.query(Lead).filter(
        (Lead.access_token == lead_token) | (Lead.lead_id == lead_token.strip().upper())
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="No registration found for this tracking ID.")

    # Check writathon deadline
    writathon = lead.writathon
    now = datetime.now(timezone.utc)
    if writathon.status != WritathonStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Story submissions for this Writathon are closed.")
    if writathon.submission_deadline and writathon.submission_deadline.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Story submission deadline for this Writathon has already passed.")

    # One story per registration. It may be replaced until a reviewer starts on it; after that the
    # plagiarism check and decision refer to a specific file, so replacing it would invalidate them.
    existing = db.query(StorySubmission).filter(StorySubmission.lead_id == lead.id).first()
    if existing and (existing.status != StoryStatus.SUBMITTED or existing.review is not None or
                     (existing.plagiarism_review and existing.plagiarism_review.status != PlagiarismStatus.NOT_CHECKED)):
        raise HTTPException(status_code=409, detail="This story is already under review and can no longer be replaced. "
                                                    "Please contact the Writathon team.")

    # Validate and save file
    file_url, original_filename, file_type, file_size = StorageService.validate_and_save_story_file(file)
    old_file_url = existing.file_url if existing else None

    if existing:
        existing.title = title
        existing.file_url = file_url
        existing.file_name = original_filename
        existing.file_type = file_type
        existing.file_size = file_size
        existing.word_count = word_count
        existing.category = category
        existing.originality_declaration = originality_declaration
        existing.status = StoryStatus.SUBMITTED
        existing.submitted_at = now
        submission = existing
    else:
        submission = StorySubmission(
            lead_id=lead.id,
            title=title,
            file_url=file_url,
            file_name=original_filename,
            file_type=file_type,
            file_size=file_size,
            word_count=word_count,
            category=category,
            originality_declaration=originality_declaration,
            status=StoryStatus.SUBMITTED,
            submitted_at=now
        )
        db.add(submission)
        db.flush()

        # Initialize manual plagiarism review record as NOT_CHECKED
        plag_review = ManualPlagiarismReview(
            story_id=submission.id,
            status=PlagiarismStatus.NOT_CHECKED
        )
        db.add(plag_review)

    # Workflow Step 2 transitions:
    # Lead Status becomes STORY_SUBMITTED (automatically disables further reminders)
    old_status = lead.status
    lead.status = LeadStatus.STORY_SUBMITTED
    try:
        db.flush()
        audit(db, None, "submission.replace" if old_file_url else "submission.create", "story_submission", submission.id,
              {"lead_id": lead.id, "file_name": original_filename, "replaced_file": old_file_url,
               "lead_status": [old_status, LeadStatus.STORY_SUBMITTED]})
        db.commit()
    except IntegrityError:
        # A concurrent submission for the same registration won (unique story_submissions.lead_id)
        db.rollback()
        StorageService.delete_file(file_url)
        raise HTTPException(status_code=409, detail="A story was already submitted for this registration.")
    except Exception:
        db.rollback()
        StorageService.delete_file(file_url)  # don't leave an orphaned upload behind a failed submission
        raise
    if old_file_url:
        StorageService.delete_file(old_file_url)
    db.refresh(submission)

    try:
        EmailService.send_submission_confirmation(db=db, lead=lead, story=submission)
    except Exception:
        logger.exception("Submission confirmation email failed for lead %s", lead.id)
        db.rollback()

    return submission

@router.get("/files/{filename}")
def download_story_file(filename: str, db: Session = Depends(get_db), staff=Depends(require_staff_or_admin)):
    """Unpublished stories are private: staff only, and only files that belong to a submission."""
    sub = db.query(StorySubmission).filter(StorySubmission.file_url == f"/api/v1/submissions/files/{os.path.basename(filename)}").first()
    if not sub:
        raise HTTPException(status_code=404, detail="Requested file not found.")
    return FileResponse(
        path=StorageService.get_file_path(filename),
        media_type=sub.file_type,
        filename=sub.file_name,
        content_disposition_type="attachment",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"},
    )

@router.get("", response_model=List[SubmissionListItem])
def list_submissions(
    writathon_id: Optional[int] = None,
    status_filter: Optional[StoryStatus] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    staff = Depends(require_staff_or_admin)
):
    query = db.query(StorySubmission, Lead, Writathon).join(Lead, StorySubmission.lead_id == Lead.id) \
        .join(Writathon, Lead.writathon_id == Writathon.id)
    if writathon_id:
        query = query.filter(Lead.writathon_id == writathon_id)
    if status_filter:
        query = query.filter(StorySubmission.status == status_filter)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(StorySubmission.title.ilike(like), Lead.child_name.ilike(like), Lead.lead_id.ilike(like)))
    rows = query.order_by(desc(StorySubmission.submitted_at)).offset(skip).limit(limit).all()
    return [
        {**StorySubmissionOut.model_validate(sub).model_dump(), "lead_code": lead.lead_id,
         "child_name": lead.child_name, "writathon_id": w.id, "writathon_name": w.name}
        for sub, lead, w in rows
    ]

@router.get("/{submission_id}", response_model=StorySubmissionOut)
def get_submission(submission_id: int, db: Session = Depends(get_db), staff = Depends(require_staff_or_admin)):
    sub = db.query(StorySubmission).filter(StorySubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Story submission not found.")
    return sub
