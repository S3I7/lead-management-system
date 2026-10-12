from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.reminder_scheduler import ReminderSchedulerService
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/scheduler", tags=["Reminder Scheduler"])

@router.post("/run-reminders")
def run_reminder_batch(
    db: Session = Depends(get_db),
    staff = Depends(require_staff_or_admin)
):
    """
    Manually triggers the reminder scheduler job to process eligible unsubmitted leads.
    """
    result = ReminderSchedulerService.process_pending_reminders(db)
    return {
        "status": "success",
        "message": result.get("error") or f"Processed {result['processed']} leads. Dispatched {result['sent']} reminder emails, skipped {result['skipped']}.",
        "data": result
    }
