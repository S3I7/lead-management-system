import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, desc, func

from app.core.database import get_db
from app.models.entities import (
    Lead, LeadStatus, Writathon, WritathonStatus, Student, User, UserRole,
    StorySubmission, StoryStatus, ManualPlagiarismReview, StoryReview, Payment, Publication, CommunicationLog
)
from app.schemas.all_schemas import (
    InterestFormSubmit, LeadOut, LeadDetailOut, LeadBulkUpdate, StorySubmissionOut,
    PlagiarismReviewOut, StoryReviewOut, PaymentOut, PublicationOut, CommunicationLogOut
)
from app.services.email_service import EmailService
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/leads", tags=["Leads"])

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I, easy to read out

def generate_lead_id(db: Session, writathon: Writathon) -> str:
    """Random tracking ID, e.g. WR-2026-K7QX9M2P. It is also the parent's key to their record, so it must not be guessable."""
    year = writathon.start_date.year if writathon.start_date else datetime.now().year
    while True:
        code = f"WR-{year}-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        if not db.query(Lead.id).filter(Lead.lead_id == code).first():
            return code

def get_or_create_student(db: Session, *, parent_name, parent_email, parent_phone, child_name,
                          child_dob, school, grade, country) -> Student:
    """Same parent email + child name = same student, so repeat Writathons don't create duplicate people."""
    email = parent_email.lower().strip()
    name = child_name.strip()
    student = db.query(Student).filter(
        Student.parent_email == email, func.lower(Student.child_name) == name.lower()
    ).first()
    if not student:
        student = Student(parent_email=email, child_name=name)
        db.add(student)
    # keep the latest contact/school details
    student.parent_name = parent_name.strip()
    student.parent_phone = parent_phone.strip()
    student.child_dob = child_dob or student.child_dob
    student.school = school.strip()
    student.grade = grade.strip()
    student.country = country.strip()
    db.flush()
    return student

@router.post("/register", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def register_interest(payload: InterestFormSubmit, db: Session = Depends(get_db)):
    if not payload.terms_accepted:
        raise HTTPException(status_code=400, detail="You must accept the terms and conditions to register.")

    writathon = db.query(Writathon).filter(Writathon.id == payload.writathon_id).first()
    if not writathon:
        raise HTTPException(status_code=404, detail="Selected Writathon not found.")
    if writathon.status != WritathonStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Registration for this Writathon is currently closed.")

    student = get_or_create_student(
        db, parent_name=payload.parent_name, parent_email=payload.parent_email,
        parent_phone=payload.parent_phone, child_name=payload.child_name, child_dob=payload.child_dob,
        school=payload.school, grade=payload.grade, country=payload.country,
    )

    # One registration per student per Writathon
    existing_lead = db.query(Lead).filter(
        Lead.writathon_id == payload.writathon_id, Lead.student_id == student.id
    ).first()
    if existing_lead:
        db.commit()
        if existing_lead.submissions:
            # Don't hand the tracking ID (= access to the record) to anyone who knows email + child name
            raise HTTPException(
                status_code=409,
                detail="This child is already registered and has submitted a story for this Writathon. "
                       "Use the tracking ID from your confirmation, or contact the team."
            )
        return existing_lead

    # Generate unique lead ID and access token
    lead_id_code = generate_lead_id(db, writathon)
    access_token = uuid.uuid4().hex

    lead = Lead(
        lead_id=lead_id_code,
        writathon_id=payload.writathon_id,
        student_id=student.id,
        parent_name=payload.parent_name.strip(),
        parent_email=payload.parent_email.lower().strip(),
        parent_phone=payload.parent_phone.strip(),
        child_name=payload.child_name.strip(),
        child_dob=payload.child_dob,
        child_age=payload.child_age,
        age_group=payload.age_group,
        submission_category=payload.submission_category,
        city=payload.city.strip(),
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
    owner_id: Optional[int] = Query(None, description="0 = unassigned"),
    submitted: Optional[bool] = None,
    story_status: Optional[StoryStatus] = None,
    student_id: Optional[int] = None,
    age_group: Optional[str] = None,
    submission_category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    staff = Depends(require_staff_or_admin)
):
    query = db.query(Lead).options(
        selectinload(Lead.submissions), selectinload(Lead.owner), selectinload(Lead.writathon)
    )
    if status_filter:
        query = query.filter(Lead.status == status_filter)
    if writathon_id:
        query = query.filter(Lead.writathon_id == writathon_id)
    if owner_id is not None:
        query = query.filter(Lead.owner_id.is_(None) if owner_id == 0 else Lead.owner_id == owner_id)
    if submitted is not None:
        has_story = Lead.submissions.any()
        query = query.filter(has_story if submitted else ~has_story)
    if story_status:
        query = query.filter(Lead.submissions.any(StorySubmission.status == story_status))
    if student_id:
        query = query.filter(Lead.student_id == student_id)
    if age_group:
        query = query.filter(Lead.age_group == age_group)
    if submission_category:
        query = query.filter(Lead.submission_category == submission_category)
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Lead.lead_id.ilike(search_fmt),
                Lead.child_name.ilike(search_fmt),
                Lead.parent_name.ilike(search_fmt),
                Lead.parent_email.ilike(search_fmt),
                Lead.school.ilike(search_fmt),
                Lead.city.ilike(search_fmt)
            )
        )
    return query.order_by(desc(Lead.created_at)).offset(skip).limit(limit).all()

@router.post("/bulk-update")
def bulk_update_leads(
    payload: LeadBulkUpdate,
    db: Session = Depends(get_db),
    staff = Depends(require_staff_or_admin)
):
    """Assign an owner and/or set the status on one or many leads."""
    values = {}
    if "owner_id" in payload.model_fields_set:
        if payload.owner_id is not None:
            owner = db.query(User).filter(User.id == payload.owner_id, User.is_active.is_(True)).first()
            if not owner or owner.role not in (UserRole.ADMIN, UserRole.STAFF):
                raise HTTPException(status_code=400, detail="Owner must be an active staff or admin user.")
        values[Lead.owner_id] = payload.owner_id
    if payload.status:
        values[Lead.status] = payload.status
    if not values:
        raise HTTPException(status_code=400, detail="Nothing to update: send owner_id and/or status.")
    values[Lead.updated_at] = datetime.now(timezone.utc)
    updated = db.query(Lead).filter(Lead.id.in_(payload.lead_ids)).update(values, synchronize_session=False)
    db.commit()
    return {"updated": updated}

@router.get("/by-token/{token}", response_model=LeadDetailOut)
def get_lead_by_token(token: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.access_token == token).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found for the provided access token.")
    return construct_lead_detail(db, lead)

@router.get("/by-code/{lead_code}", response_model=LeadDetailOut)
def get_lead_by_code(lead_code: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.lead_id == lead_code.strip().upper()).first()
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
