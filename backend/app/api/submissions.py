import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import (
    Lead, LeadStatus, StorySubmission, StoryStatus,
    ManualPlagiarismReview, PlagiarismStatus, WritathonStatus
)
from app.schemas.all_schemas import StorySubmissionOut
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
        (Lead.access_token == lead_token) | (Lead.lead_id == lead_token)
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found for the provided token or ID.")

    # Check writathon deadline
    writathon = lead.writathon
    now = datetime.now(timezone.utc)
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

@router.get("/{submission_id}", response_model=StorySubmissionOut)
def get_submission(submission_id: int, db: Session = Depends(get_db)):
    sub = db.query(StorySubmission).filter(StorySubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Story submission not found.")
    return sub
