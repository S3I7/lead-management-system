import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.core.database import get_db
from app.models.entities import (
    Lead, LeadStatus, StorySubmission, StoryStatus,
    ManualPlagiarismReview, PlagiarismStatus, WritathonStatus, Writathon
)
from app.schemas.all_schemas import StorySubmissionOut, SubmissionListItem
from app.api.deps import require_staff_or_admin
from app.services.storage_service import StorageService
from app.services.email_service import EmailService

router = APIRouter(prefix="/submissions", tags=["Story Submissions"])

@router.post("", response_model=StorySubmissionOut, status_code=status.HTTP_201_CREATED)
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

    # Authenticate lead
    lead = db.query(Lead).filter(
        (Lead.access_token == lead_token) | (Lead.lead_id == lead_token.strip().upper())
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found for the provided token or ID.")

    # Check writathon deadline
    writathon = lead.writathon
    now = datetime.now(timezone.utc)
    if writathon.status != WritathonStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Story submissions for this Writathon are closed.")
    if writathon.submission_deadline and writathon.submission_deadline.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Story submission deadline for this Writathon has already passed.")

    # Prevent multiple submissions if already approved/completed
    existing = db.query(StorySubmission).filter(StorySubmission.lead_id == lead.id).first()
    if existing and existing.status in [StoryStatus.APPROVED, StoryStatus.PUBLISHED]:
        raise HTTPException(status_code=400, detail="Story has already been approved/published and cannot be resubmitted.")

    # Validate and save file
    file_url, original_filename, file_type, file_size = StorageService.validate_and_save_story_file(file)

    if existing:
        existing.title = title.strip()
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
            title=title.strip(),
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
    lead.status = LeadStatus.STORY_SUBMITTED
    db.commit()
    db.refresh(submission)

    # Send submission confirmation email
    try:
        EmailService.send_submission_confirmation(db=db, lead=lead, story=submission)
    except Exception as e:
        pass

    return submission

@router.get("/files/{filename}")
def download_story_file(filename: str):
    file_path = StorageService.get_file_path(filename)
    # Determine media type based on extension
    media_type = "application/pdf" if filename.endswith(".pdf") else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
        content_disposition_type="inline"
    )

@router.get("", response_model=List[SubmissionListItem])
def list_submissions(
    writathon_id: Optional[int] = None,
    status_filter: Optional[StoryStatus] = None,
    search: Optional[str] = None,
    skip: int = 0,
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
