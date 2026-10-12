from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.entities import (Writathon, Student, Lead, LeadStatus, StorySubmission, StoryStatus, Publication,
                                 PublicationStatus, Payment, PaymentStatus, StoryReview, ReviewDecision, User, UserRole)
from app.schemas.all_schemas import DashboardStats, StaffDashboardStats
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/staff-stats", response_model=StaffDashboardStats)
def get_staff_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """Staff-specific dashboard metrics: only records assigned to the logged-in staff member,
    plus editorial queue status. Does not expose organization-wide metrics or revenue."""
    uid = current_user.id
    assigned_leads = db.query(Lead).filter(Lead.owner_id == uid).count()
    contacted = db.query(Lead).filter(Lead.owner_id == uid, Lead.status == LeadStatus.CONTACTED).count()
    reminder_sent = db.query(Lead).filter(Lead.owner_id == uid, Lead.status == LeadStatus.REMINDER_SENT).count()
    stories_submitted = db.query(Lead).filter(Lead.owner_id == uid, Lead.status == LeadStatus.STORY_SUBMITTED).count()
    under_review = db.query(Lead).filter(Lead.owner_id == uid, Lead.status == LeadStatus.UNDER_REVIEW).count()
    eligible = db.query(Lead).filter(Lead.owner_id == uid, Lead.status == LeadStatus.ELIGIBLE).count()
    not_eligible = db.query(Lead).filter(Lead.owner_id == uid, Lead.status == LeadStatus.NOT_ELIGIBLE).count()
    payment_pending = db.query(Lead).filter(Lead.owner_id == uid, Lead.status == LeadStatus.PAYMENT_PENDING).count()
    paid = db.query(Payment).join(Lead, Payment.lead_id == Lead.id).filter(Lead.owner_id == uid, Payment.status == PaymentStatus.PAID).count()
    completed = db.query(Lead).filter(Lead.owner_id == uid, Lead.status == LeadStatus.COMPLETED).count()
    published = db.query(Publication).join(StorySubmission, Publication.story_id == StorySubmission.id) \
        .join(Lead, StorySubmission.lead_id == Lead.id).filter(Lead.owner_id == uid, Publication.publication_status == PublicationStatus.PUBLISHED).count()

    awaiting_review = db.query(StorySubmission).filter(~StorySubmission.review.has()).count()
    pending_tasks = contacted + reminder_sent + payment_pending

    return {
        "assigned_leads": assigned_leads,
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
        "awaiting_review": awaiting_review,
        "pending_tasks": pending_tasks
    }

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
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

    # Revenue calculation from completed payments (only admins see actual unrestricted revenue)
    if current_user.role == UserRole.ADMIN:
        revenue_sum = db.query(func.sum(Payment.amount)).filter(Payment.status == PaymentStatus.PAID).scalar() or 0.0
    else:
        revenue_sum = 0.0

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

    # Report metrics. Lead-status counts above are "current pipeline stage" (a lead counts once, at its
    # current stage). The metrics below count records, so they don't drift as leads move on:
    #   awaiting_review      = submissions with no eligibility decision yet
    #   *_decisions          = recorded eligibility decisions (one per story)
    #   conversion_rate      = registrations with a PAID payment / all registrations, in %
    total_submissions = db.query(StorySubmission).count()
    decisions = dict(db.query(StoryReview.decision, func.count(StoryReview.id)).group_by(StoryReview.decision).all())
    converted = db.query(func.count(func.distinct(Payment.lead_id))).filter(Payment.status == PaymentStatus.PAID).scalar() or 0
    owners = db.query(Lead.owner_id, User.full_name, func.count(Lead.id)).outerjoin(User, User.id == Lead.owner_id)         .group_by(Lead.owner_id, User.full_name).all()

    return {
        "total_writathons": db.query(Writathon).count(),
        "total_submissions": total_submissions,
        "registered_not_submitted": total_leads - total_submissions,
        "awaiting_review": db.query(StorySubmission).filter(~StorySubmission.review.has()).count(),
        "eligible_decisions": decisions.get(ReviewDecision.ELIGIBLE, 0),
        "not_eligible_decisions": decisions.get(ReviewDecision.NOT_ELIGIBLE, 0),
        "conversion_rate": round(100.0 * converted / total_leads, 1) if total_leads else 0.0,
        "owner_distribution": [{"owner_id": oid, "owner_name": name or "Unassigned", "leads": n} for oid, name, n in owners],
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
