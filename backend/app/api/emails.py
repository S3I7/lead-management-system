from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import (
    EmailTemplate, TemplateCode, CommunicationLog, CommStatus, Lead, User
)
from app.schemas.all_schemas import (
    EmailTemplateOut, EmailTemplateUpdate, TemplatePreviewRequest,
    CommunicationLogOut
)
from app.services.email_service import EmailService, DEFAULT_TEMPLATES
from app.api.deps import require_staff_or_admin, require_admin

router = APIRouter(prefix="/emails", tags=["Email Templates & Communications"])

@router.get("/templates", response_model=List[EmailTemplateOut])
def list_email_templates(db: Session = Depends(get_db), staff: User = Depends(require_staff_or_admin)):
    templates = db.query(EmailTemplate).all()
    # If table is empty, auto-seed defaults
    if not templates:
        for code, data in DEFAULT_TEMPLATES.items():
            t = EmailTemplate(
                template_code=code,
                name=data["name"],
                subject_template=data["subject"],
                body_template=data["body"],
                is_active=True
            )
            db.add(t)
        db.commit()
        templates = db.query(EmailTemplate).all()
    return templates

@router.put("/templates/{template_id}", response_model=EmailTemplateOut)
def update_email_template(
    template_id: int,
    payload: EmailTemplateUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    tmpl = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Email template not found.")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(tmpl, k, v)

    db.commit()
    db.refresh(tmpl)
    return tmpl

@router.post("/templates/preview")
def preview_email_template(
    payload: TemplatePreviewRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff_or_admin)
):
    tmpl = db.query(EmailTemplate).filter(EmailTemplate.template_code == payload.template_code).first()
    if tmpl:
        subject_tpl = tmpl.subject_template
        body_tpl = tmpl.body_template
    elif payload.template_code in DEFAULT_TEMPLATES:
        subject_tpl = DEFAULT_TEMPLATES[payload.template_code]["subject"]
        body_tpl = DEFAULT_TEMPLATES[payload.template_code]["body"]
    else:
        raise HTTPException(status_code=404, detail="Template code not recognized.")

    sample_ctx = {
        "child_name": "Aarav Sharma",
        "child_age": 10,
        "grade": "Grade 5",
        "parent_name": "Pooja Sharma",
        "lead_id": "WR-2026-000101",
        "writathon_name": "Writathon 2026",
        "submission_deadline": "November 30, 2026",
        "guidelines": "Submit original 500-1000 word stories in DOCX or PDF.",
        "submission_url": "http://localhost:5173/submit-story/WR-2026-000101?token=sample",
        "story_title": "The Quest of the Whispering Wind",
        "submission_date": "October 6, 2026",
        "feedback": "Vivid characterization, extraordinary emotional depth!",
        "payment_link": "http://localhost:5173/payment/sample_token",
        "amount": "499.00",
        "currency": "INR",
        "expiry_date": "October 15, 2026",
        "payment_ref": "TXN-8829103",
        "payment_date": "October 6, 2026",
        **(payload.sample_context or {})
    }

    return {
        "subject": EmailService.render_template(subject_tpl, sample_ctx),
        "html_body": EmailService.render_template(body_tpl, sample_ctx)
    }

@router.get("/communications", response_model=List[CommunicationLogOut])
def list_communications(
    lead_id: Optional[int] = None,
    template: Optional[str] = None,
    recipient: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff_or_admin)
):
    query = db.query(CommunicationLog)
    if lead_id:
        query = query.filter(CommunicationLog.lead_id == lead_id)
    if template:
        query = query.filter(CommunicationLog.template == template)
    if recipient:
        query = query.filter(CommunicationLog.recipient.ilike(f"%{recipient.strip()}%"))
    return query.order_by(desc(CommunicationLog.created_at)).offset(skip).limit(limit).all()

@router.post("/communications/resend/{comm_id}", response_model=CommunicationLogOut)
def resend_communication(
    comm_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff_or_admin)
):
    comm = db.query(CommunicationLog).filter(CommunicationLog.id == comm_id).first()
    if not comm:
        raise HTTPException(status_code=404, detail="Communication log not found.")

    new_comm = CommunicationLog(
        lead_id=comm.lead_id,
        type=comm.type,
        template=comm.template,
        recipient=comm.recipient,
        subject=comm.subject,
        body_content=comm.body_content,
        status=CommStatus.SENT,
        sent_at=datetime.now(timezone.utc),
        error_message=None
    )
    db.add(new_comm)
    db.commit()
    db.refresh(new_comm)
    return new_comm
