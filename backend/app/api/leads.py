import logging
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, desc, func

from app.core.database import get_db
from app.models.entities import (
    Lead, LeadStatus, Writathon, WritathonStatus, Student, User, UserRole,
    StorySubmission, StoryStatus, ManualPlagiarismReview, StoryReview, Payment, PaymentStatus, Publication,
    CommunicationLog, TemplateCode, CommStatus
)
from app.schemas.all_schemas import InterestFormSubmit, LeadOut, LeadDetailOut, LeadBulkUpdate, PublicLeadDetailOut
from app.services.email_service import EmailService
from app.api.deps import require_staff_or_admin
from app.core.audit import audit
from app.core.rate_limit import rate_limit

logger = logging.getLogger(__name__)

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
    if student:
        # The public form is unauthenticated: don't let it overwrite a known student's contact details.
        # Each registration (Lead) keeps its own copy of what was submitted.
        return student
    student = Student(parent_email=email, child_name=name, parent_name=parent_name.strip(),
                      parent_phone=parent_phone.strip(), child_dob=child_dob, school=school.strip(),
                      grade=grade.strip(), country=country.strip())
    db.add(student)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        student = db.query(Student).filter(
            Student.parent_email == email, func.lower(Student.child_name) == name.lower()
        ).first()
        if student:
            return student
        raise
    return student

ALREADY_REGISTERED = ("This child is already registered for this Writathon. We've re-sent the confirmation "
                      "with the tracking ID to the email address used at registration.")

def resend_confirmation(db: Session, lead: Lead) -> None:
    """Forgotten tracking ID: re-send it to the address on file (never to the requester), at most every 15 minutes."""
    since = (datetime.now(timezone.utc) - timedelta(minutes=15)).replace(tzinfo=None)
    recent = db.query(CommunicationLog.id).filter(
        CommunicationLog.lead_id == lead.id,
        CommunicationLog.template == TemplateCode.INTEREST_CONFIRMATION.value,
        CommunicationLog.created_at >= since,
    ).first()
    if not recent:
        EmailService.send_interest_confirmation(db=db, lead=lead, writathon=lead.writathon)

@router.post("/register", response_model=LeadOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit)])
def register_interest(payload: InterestFormSubmit, db: Session = Depends(get_db)):
    if not payload.terms_accepted:
        raise HTTPException(status_code=400, detail="You must accept the terms and conditions to register.")

    writathon = db.query(Writathon).filter(Writathon.id == payload.writathon_id).first()
    if not writathon:
        raise HTTPException(status_code=404, detail="Selected Writathon not found.")
    if writathon.status != WritathonStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Registration for this Writathon is currently closed.")
    if writathon.submission_deadline and writathon.submission_deadline.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Registration for this Writathon is closed: the submission deadline has passed.")

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
        # Don't hand the tracking ID (= access to the record) to anyone who knows email + child name
        resend_confirmation(db, existing_lead)
        raise HTTPException(status_code=409, detail=ALREADY_REGISTERED)

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
    try:
        db.flush()
        audit(db, None, "lead.create", "lead", lead.id, {"writathon_id": writathon.id, "student_id": student.id, "source": "WEBSITE",
                                                    "terms_accepted": True})  # consent record, timestamped by the audit row
        db.commit()
    except IntegrityError:
        # A concurrent request registered the same student/Writathon first (DB unique constraints)
        db.rollback()
        raise HTTPException(status_code=409, detail=ALREADY_REGISTERED)
    db.refresh(lead)

    # Confirmation email; the lead only becomes CONTACTED when it was actually delivered
    try:
        comm = EmailService.send_interest_confirmation(db=db, lead=lead, writathon=writathon)
        if comm.status == CommStatus.SENT:
            lead.status = LeadStatus.CONTACTED
            db.commit()
            db.refresh(lead)
    except Exception:
        logger.exception("Confirmation email failed for lead %s", lead.id)
        db.rollback()

    return lead

@router.get("", response_model=List[LeadOut])
def list_leads(
    response: Response,
    status_filter: Optional[LeadStatus] = None,
    writathon_id: Optional[int] = None,
    owner_id: Optional[int] = Query(None, description="0 = unassigned"),
    submitted: Optional[bool] = None,
    story_status: Optional[StoryStatus] = None,
    student_id: Optional[int] = None,
    age_group: Optional[str] = None,
    submission_category: Optional[str] = None,
    payment_status: Optional[PaymentStatus] = None,
    registered_from: Optional[date] = None,
    registered_to: Optional[date] = None,
    submitted_from: Optional[date] = None,
    submitted_to: Optional[date] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """Filters combine with AND. X-Total-Count = matches before skip/limit, so pages stay consistent."""
    if current_user.role == UserRole.STAFF:
        if owner_id is not None and owner_id != 0 and owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff members cannot view leads assigned to other team members."
            )

    query = db.query(Lead).options(
        selectinload(Lead.submissions), selectinload(Lead.owner), selectinload(Lead.writathon)
    )
    if current_user.role == UserRole.STAFF and owner_id is None:
        query = query.filter(or_(Lead.owner_id == current_user.id, Lead.owner_id.is_(None)))
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
    day = lambda d: datetime.combine(d, datetime.min.time())
    if payment_status:
        query = query.filter(Lead.payments.any(Payment.status == payment_status))
    if registered_from:
        query = query.filter(Lead.created_at >= day(registered_from))
    if registered_to:
        query = query.filter(Lead.created_at < day(registered_to + timedelta(days=1)))
    if submitted_from:
        query = query.filter(Lead.submissions.any(StorySubmission.submitted_at >= day(submitted_from)))
    if submitted_to:
        query = query.filter(Lead.submissions.any(StorySubmission.submitted_at < day(submitted_to + timedelta(days=1))))
    if age_group:
        age_clean = age_group.strip()
        if age_clean == "8-10":
            query = query.filter(or_(Lead.age_group == "8-10", Lead.child_age.between(8, 10)))
        elif age_clean == "11-13":
            query = query.filter(or_(Lead.age_group == "11-13", Lead.child_age.between(11, 13)))
        elif age_clean == "14-18":
            query = query.filter(or_(Lead.age_group == "14-18", Lead.child_age.between(14, 18)))
        else:
            query = query.filter(Lead.age_group == age_clean)
    if submission_category:
        cat_clean = submission_category.strip()
        if cat_clean.lower() in ("other", "other…", "other..."):
            standard_cats = ["short story", "poem", "novella", "comics"]
            query = query.filter(
                or_(
                    Lead.submission_category.ilike("other%"),
                    ~func.lower(Lead.submission_category).in_(standard_cats)
                )
            )
        else:
            query = query.filter(Lead.submission_category.ilike(cat_clean))
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Lead.lead_id.ilike(search_fmt),
                Lead.child_name.ilike(search_fmt),
                Lead.parent_name.ilike(search_fmt),
                Lead.parent_email.ilike(search_fmt),
                Lead.school.ilike(search_fmt),
                Lead.city.ilike(search_fmt),
                Lead.submission_category.ilike(search_fmt)
            )
        )
    response.headers["X-Total-Count"] = str(query.order_by(None).count())
    return query.order_by(desc(Lead.created_at), desc(Lead.id)).offset(skip).limit(limit).all()

# Staff may set these by hand, and only on leads still in one of them. Later statuses are driven by the
# workflow (submission, review, payment) so they always agree with the submission/review/payment records.
MANUAL_LEAD_STATUSES = {LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.REMINDER_SENT}

@router.post("/bulk-update")
def bulk_update_leads(
    payload: LeadBulkUpdate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff_or_admin)
):
    """Assign an owner and/or set a manual status on one or many leads. Each lead is checked and audited;
    the response lists what was skipped and why."""
    set_owner = "owner_id" in payload.model_fields_set
    if set_owner:
        if staff.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can assign or reassign leads to team members."
            )
        if payload.owner_id is not None:
            owner = db.query(User).filter(User.id == payload.owner_id, User.is_active.is_(True)).first()
            if not owner or owner.role not in (UserRole.ADMIN, UserRole.STAFF):
                raise HTTPException(status_code=400, detail="Owner must be an active staff or admin user.")
    if payload.status and payload.status not in MANUAL_LEAD_STATUSES:
        allowed = ", ".join(sorted(st.value for st in MANUAL_LEAD_STATUSES))
        raise HTTPException(status_code=400, detail=f"Status {payload.status.value} is set by the workflow, not by hand. Allowed: {allowed}.")
    if not set_owner and not payload.status:
        raise HTTPException(status_code=400, detail="Nothing to update: send owner_id and/or status.")

    ids = set(payload.lead_ids)
    leads = db.query(Lead).filter(Lead.id.in_(ids)).with_for_update().all()
    skipped = [{"id": i, "reason": "Lead not found."} for i in sorted(ids - {l.id for l in leads})]
    updated = 0
    for lead in leads:
        changes = {}
        if payload.status and lead.status != payload.status:
            if lead.status not in MANUAL_LEAD_STATUSES:
                skipped.append({"id": lead.id, "reason": f"Lead is at {lead.status.value}; its status follows the workflow."})
                continue
            changes["status"] = [lead.status, payload.status]
            lead.status = payload.status
        if set_owner and lead.owner_id != payload.owner_id:
            changes["owner_id"] = [lead.owner_id, payload.owner_id]
            lead.owner_id = payload.owner_id
        if changes:
            audit(db, staff, "lead.bulk_update", "lead", lead.id, changes)
            updated += 1
    db.commit()
    return {"updated": updated, "skipped": skipped}

class ExportAuditPayload(BaseModel):
    count: int
    lead_ids: Optional[List[int]] = None

@router.post("/export-audit")
def audit_export(
    payload: ExportAuditPayload,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff_or_admin)
):
    """Records staff and admin lead CSV export operations in the append-only audit trail."""
    audit(
        db,
        staff,
        "lead.export_csv",
        "lead",
        None,
        {"exported_count": payload.count, "sample_ids": payload.lead_ids[:20] if payload.lead_ids else None}
    )
    db.commit()
    return {"status": "ok", "message": "Export operation audited."}

NOT_FOUND = "No registration found for this tracking ID."

@router.get("/by-token/{token}", response_model=PublicLeadDetailOut, dependencies=[Depends(rate_limit)])
def get_lead_by_token(token: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.access_token == token).first()
    if not lead:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return construct_public_detail(db, lead)

@router.get("/by-code/{lead_code}", response_model=PublicLeadDetailOut, dependencies=[Depends(rate_limit)])
def get_lead_by_code(lead_code: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.lead_id == lead_code.strip().upper()).first()
    if not lead:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return construct_public_detail(db, lead)

def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"

def construct_public_detail(db: Session, lead: Lead) -> dict:
    """Parent-facing status: same shape as the staff view, minus contact details, internal notes, files and email bodies."""
    d = construct_lead_detail(db, lead)
    lead_view = {k: getattr(lead, k) for k in (
        "lead_id", "writathon_id", "writathon_name", "parent_name", "child_name", "child_age", "age_group",
        "submission_category", "school", "grade", "status", "submission_status", "created_at")}
    lead_view["parent_email"] = mask_email(lead.parent_email)
    payment = d["payment"]
    if payment is not None:
        payable = payment.status in (PaymentStatus.LINK_SENT, PaymentStatus.PENDING, PaymentStatus.FAILED)
        payment = {"amount": float(payment.amount), "currency": payment.currency, "status": payment.status,
                   "link_expires_at": payment.link_expires_at, "paid_at": payment.paid_at,
                   "payment_link_token": payment.payment_link_token if payable else None}
    return {**d, "lead": lead_view, "payment": payment}

@router.get("/{lead_pk}", response_model=LeadDetailOut)
def get_lead_detail(
    lead_pk: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    lead = db.query(Lead).filter(Lead.id == lead_pk).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    if current_user.role == UserRole.STAFF and lead.owner_id is not None and lead.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: lead is assigned to another team member."
        )
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
