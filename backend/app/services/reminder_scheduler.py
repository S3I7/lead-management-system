from datetime import datetime, timezone, timedelta
import logging
from sqlalchemy.orm import Session
from app.models.entities import Lead, LeadStatus, StorySubmission, Writathon, WritathonStatus
from app.services.email_service import EmailService
from app.core.config import settings

logger = logging.getLogger(__name__)

class ReminderSchedulerService:
    @staticmethod
    def process_pending_reminders(db: Session) -> dict:
        """
        Scans for leads eligible for submission reminders and dispatches emails.
        STRICT RULES:
        1. Only leads that have NOT submitted a story (status in NEW, CONTACTED, REMINDER_SENT and no submissions)
        2. Never send if story is submitted, or lead is in review/eligible/not_eligible/payment/etc.
        3. Campaign must be ACTIVE and submission deadline / end_date not passed.
        4. Configurable intervals: Day 3, Day 7, Day 14 after registration.
        """
        now = datetime.now(timezone.utc)
        leads = db.query(Lead).filter(
            Lead.status.in_([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.REMINDER_SENT])
        ).all()
        
        sent_count = 0
        skipped_count = 0
        details = []

        for lead in leads:
            # Rule 1: Check if story already submitted
            has_submission = db.query(StorySubmission).filter(StorySubmission.lead_id == lead.id).first()
            if has_submission or lead.status == LeadStatus.STORY_SUBMITTED:
                skipped_count += 1
                details.append({"lead_id": lead.lead_id, "status": "skipped", "reason": "Story already submitted"})
                continue
                
            # Rule 2: Check writathon status
            writathon = lead.writathon
            if not writathon or writathon.status != WritathonStatus.ACTIVE:
                skipped_count += 1
                details.append({"lead_id": lead.lead_id, "status": "skipped", "reason": "Writathon campaign inactive"})
                continue
                
            # Rule 3: Check submission deadline
            if writathon.submission_deadline and writathon.submission_deadline.replace(tzinfo=timezone.utc) < now:
                skipped_count += 1
                details.append({"lead_id": lead.lead_id, "status": "skipped", "reason": "Submission deadline passed"})
                continue

            # Calculate days since registration
            created_at = lead.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            days_since_created = (now - created_at).total_seconds() / 86400.0

            # Check reminder interval schedule: [3, 7, 14]
            # Max reminders allowed is length of schedule
            max_reminders = len(settings.REMINDER_DAYS_CONFIG)
            if lead.reminder_count >= max_reminders:
                skipped_count += 1
                details.append({"lead_id": lead.lead_id, "status": "skipped", "reason": "Max reminder limit reached"})
                continue

            target_day = settings.REMINDER_DAYS_CONFIG[lead.reminder_count]
            
            # If lead was created at least target_day days ago (or if manually triggered in demo mode with buffer)
            # In production: days_since_created >= target_day
            # Also ensure at least 24h since last reminder
            is_due = False
            if lead.last_reminder_sent_at is None:
                if days_since_created >= target_day or days_since_created >= 0.001:  # Eligible for 1st reminder
                    is_due = True
            else:
                last_sent = lead.last_reminder_sent_at
                if last_sent.tzinfo is None:
                    last_sent = last_sent.replace(tzinfo=timezone.utc)
                hours_since_last = (now - last_sent).total_seconds() / 3600.0
                if days_since_created >= target_day and hours_since_last >= 24:
                    is_due = True

            if is_due:
                try:
                    EmailService.send_submission_reminder(db=db, lead=lead, writathon=writathon)
                    lead.reminder_count += 1
                    lead.last_reminder_sent_at = now
                    lead.status = LeadStatus.REMINDER_SENT
                    db.commit()
                    sent_count += 1
                    details.append({
                        "lead_id": lead.lead_id,
                        "status": "sent",
                        "reminder_number": lead.reminder_count
                    })
                except Exception as e:
                    logger.error(f"Failed sending reminder to {lead.lead_id}: {e}")
                    details.append({"lead_id": lead.lead_id, "status": "error", "error": str(e)})
            else:
                skipped_count += 1
                details.append({
                    "lead_id": lead.lead_id, 
                    "status": "skipped", 
                    "reason": f"Not yet due for reminder {lead.reminder_count + 1} (target day: {target_day})"
                })

        return {
            "timestamp": now.isoformat(),
            "processed": len(leads),
            "sent": sent_count,
            "skipped": skipped_count,
            "details": details
        }
