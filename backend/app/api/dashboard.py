from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.entities import Writathon, Student, Lead, LeadStatus, StorySubmission, StoryStatus, Publication, PublicationStatus, Payment, PaymentStatus
from app.schemas.all_schemas import DashboardStats
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    staff = Depends(require_staff_or_admin)
):
    # Total count
    total_leads = db.query(Lead).count()

    # Exact status counts
    new_leads = db.query(Lead).filter(Lead.status == LeadStatus.NEW).count()
    contacted = db.query(Lead).filter(Lead.status == LeadStatus.CONTACTED).count()
    reminder_sent = db.query(Lead).filter(Lead.status == LeadStatus.REMINDER_SENT).count()
    stories_submitted = db.query(Lead).filter(Lead.status == LeadStatus.STORY_SUBMITTED).count()
    under_review = db.query(Lead).filter(Lead.status == LeadStatus.UNDER_REVIEW).count()
    eligible = db.query(Lead).filter(Lead.status == LeadStatus.ELIGIBLE).count()
    not_eligible = db.query(Lead).filter(Lead.status == LeadStatus.NOT_ELIGIBLE).count()
    payment_pending = db.query(Lead).filter(Lead.status == LeadStatus.PAYMENT_PENDING).count()
    paid = db.query(Payment).filter(Payment.status == PaymentStatus.PAID).count()
    completed = db.query(Lead).filter(Lead.status == LeadStatus.COMPLETED).count()
    published = db.query(Publication).filter(Publication.publication_status == PublicationStatus.PUBLISHED).count()

    # Revenue calculation from completed payments
    revenue_sum = db.query(func.sum(Payment.amount)).filter(Payment.status == PaymentStatus.PAID).scalar() or 0.0

    # Per-Writathon registrations vs submissions, two grouped queries regardless of Writathon count
    regs = dict(db.query(Lead.writathon_id, func.count(Lead.id)).group_by(Lead.writathon_id).all())
    subs = dict(db.query(Lead.writathon_id, func.count(StorySubmission.id))
                .join(StorySubmission, StorySubmission.lead_id == Lead.id).group_by(Lead.writathon_id).all())
    by_writathon = [
        {"writathon_id": w.id, "writathon_name": w.name, "status": w.status,
         "registrations": regs.get(w.id, 0), "submissions": subs.get(w.id, 0),
         "not_submitted": regs.get(w.id, 0) - subs.get(w.id, 0)}
        for w in db.query(Writathon).order_by(Writathon.start_date.desc()).all()
    ]

    return {
        "total_students": db.query(Student).count(),
        "unassigned_leads": db.query(Lead).filter(Lead.owner_id.is_(None)).count(),
        "by_writathon": by_writathon,
        "total_leads": total_leads,
        "new_leads": new_leads,
        "contacted": contacted,
        "reminder_sent": reminder_sent,
        "stories_submitted": stories_submitted,
        "under_review": under_review,
        "eligible": eligible,
        "not_eligible": not_eligible,
        "payment_pending": payment_pending,
        "paid": paid,
        "completed": completed,
        "published": published,
        "revenue_total": float(revenue_sum),
        "currency": "INR"
    }
