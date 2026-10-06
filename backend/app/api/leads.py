import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.core.database import get_db
from app.models.entities import (
    Lead, LeadStatus, Writathon, WritathonStatus,
    StorySubmission, ManualPlagiarismReview, StoryReview, Payment, Publication, CommunicationLog
)
from app.schemas.all_schemas import (
    InterestFormSubmit, LeadOut, LeadDetailOut, StorySubmissionOut,
    PlagiarismReviewOut, StoryReviewOut, PaymentOut, PublicationOut, CommunicationLogOut
)
from app.services.email_service import EmailService
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/leads", tags=["Leads"])

def generate_lead_id(db: Session, writathon: Writathon) -> str:
    year = writathon.start_date.year if writathon.start_date else datetime.now().year
    count = db.query(Lead).filter(Lead.writathon_id == writathon.id).count() + 1
    return f"WR-{year}-{count:06d}"

@router.post("/register", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def register_interest(payload: InterestFormSubmit, db: Session = Depends(get_db)):
    if not payload.terms_accepted:
        raise HTTPException(status_code=400, detail="You must accept the terms and conditions to register.")

    writathon = db.query(Writathon).filter(Writathon.id == payload.writathon_id).first()
    if not writathon:
        raise HTTPException(status_code=404, detail="Selected Writathon not found.")
    if writathon.status != WritathonStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Registration for this Writathon is currently closed.")

    # Duplicate detection rule: avoid duplicate registrations for same child & email in same campaign
    existing_lead = db.query(Lead).filter(
        Lead.writathon_id == payload.writathon_id,
        Lead.parent_email == payload.parent_email,
        Lead.child_name.ilike(payload.child_name.strip())
    ).first()
    if existing_lead:
        # Return existing lead cleanly to prevent accidental double-registrations
        return existing_lead

    # Generate unique lead ID and access token
    lead_id_code = generate_lead_id(db, writathon)
    access_token = uuid.uuid4().hex

    lead = Lead(
        lead_id=lead_id_code,
        writathon_id=payload.writathon_id,
        parent_name=payload.parent_name.strip(),
        parent_email=payload.parent_email.lower().strip(),
        parent_phone=payload.parent_phone.strip(),
        child_name=payload.child_name.strip(),
        child_dob=payload.child_dob,
        child_age=payload.child_age,
        school=payload.school.strip(),
        grade=payload.grade.strip(),
        country=payload.country.strip(),
        status=LeadStatus.NEW,
        source="WEBSITE",
        access_token=access_token,
        reminder_count=0
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Workflow Step: Confirmation Email -> Lead Status becomes CONTACTED
    try:
        EmailService.send_interest_confirmation(db=db, lead=lead, writathon=writathon)
        lead.status = LeadStatus.CONTACTED
        db.commit()
        db.refresh(lead)
    except Exception as e:
        # Error logged inside email service
        pass

    return lead

@router.get("", response_model=List[LeadOut])
def list_leads(
    status_filter: Optional[LeadStatus] = None,
    writathon_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    staff = Depends(require_staff_or_admin)
):
    query = db.query(Lead)
    if status_filter:
        query = query.filter(Lead.status == status_filter)
    if writathon_id:
        query = query.filter(Lead.writathon_id == writathon_id)
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Lead.lead_id.ilike(search_fmt),
                Lead.child_name.ilike(search_fmt),
                Lead.parent_name.ilike(search_fmt),
                Lead.parent_email.ilike(search_fmt),
                Lead.school.ilike(search_fmt)
            )
        )
    return query.order_by(desc(Lead.created_at)).offset(skip).limit(limit).all()

@router.get("/by-token/{token}", response_model=LeadDetailOut)
def get_lead_by_token(token: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.access_token == token).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found for the provided access token.")
    return construct_lead_detail(db, lead)

@router.get("/by-code/{lead_code}", response_model=LeadDetailOut)
def get_lead_by_code(lead_code: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.lead_id == lead_code).first()
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead with code {lead_code} not found.")
    return construct_lead_detail(db, lead)

@router.get("/{lead_pk}", response_model=LeadDetailOut)
def get_lead_detail(
    lead_pk: int,
    db: Session = Depends(get_db),
    staff = Depends(require_staff_or_admin)
):
    lead = db.query(Lead).filter(Lead.id == lead_pk).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return construct_lead_detail(db, lead)

def construct_lead_detail(db: Session, lead: Lead) -> dict:
    submission = db.query(StorySubmission).filter(StorySubmission.lead_id == lead.id).first()
    plagiarism_review = None
    story_review = None
    payment = db.query(Payment).filter(Payment.lead_id == lead.id).order_by(desc(Payment.id)).first()
    publication = None

    if submission:
        plagiarism_review = db.query(ManualPlagiarismReview).filter(
            ManualPlagiarismReview.story_id == submission.id
        ).first()
        story_review = db.query(StoryReview).filter(
            StoryReview.story_id == submission.id
        ).first()
        publication = db.query(Publication).filter(
            Publication.story_id == submission.id
        ).first()

    communications = db.query(CommunicationLog).filter(
        CommunicationLog.lead_id == lead.id
    ).order_by(desc(CommunicationLog.created_at)).all()

    return {
        "lead": lead,
        "writathon": lead.writathon,
        "submission": submission,
        "plagiarism_review": plagiarism_review,
        "story_review": story_review,
        "payment": payment,
        "publication": publication,
        "communications": communications
    }
