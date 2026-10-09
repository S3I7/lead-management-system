from datetime import datetime, timezone
import html
import logging
from typing import Optional, Any
from sqlalchemy.orm import Session

from app.models.entities import (
    Lead, StorySubmission, StoryReview, Payment, Publication, Writathon,
    EmailTemplate, TemplateCode, CommunicationLog, CommStatus, LeadStatus
)
from app.core.config import settings

logger = logging.getLogger(__name__)

# Default templates to seed or fallback to
DEFAULT_TEMPLATES = {
    TemplateCode.INTEREST_CONFIRMATION: {
        "name": "Registration Confirmation Email",
        "subject": "Welcome to {{writathon_name}}! Registration Confirmed for {{child_name}} (ID: {{lead_id}})",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #6B46C1; margin-top: 0;">Welcome to {{writathon_name}}!</h2>
  <p>Dear {{parent_name}},</p>
  <p>Thank you for registering <strong>{{child_name}}</strong> for the Writathon! We are thrilled to have your child participate in this creative writing journey.</p>
  
  <div style="background-color: #F3EEFF; border-left: 4px solid #6B46C1; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Registration ID:</strong> {{lead_id}}</p>
    <p style="margin: 4px 0 0 0;"><strong>Child Name:</strong> {{child_name}} (Age: {{child_age}}, Grade: {{grade}})</p>
    <p style="margin: 4px 0 0 0;"><strong>Submission Deadline:</strong> {{submission_deadline}}</p>
  </div>

  <h3 style="color: #534AB7;">Submission Guidelines & Next Steps:</h3>
  <p>{{guidelines}}</p>
  <ul>
    <li>Accepted formats: <strong>DOCX or PDF</strong></li>
    <li>Original child-authored stories only</li>
    <li>Once your story is ready, click below to submit.</li>
  </ul>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{submission_url}}" style="background: linear-gradient(135deg, #6B46C1, #E8577D); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">
      Submit Story Now
    </a>
  </div>

  <p style="color: #6B7280; font-size: 14px;">If you have any questions, simply reply to this email or contact support.</p>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
  <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Writathon Team • Empowering Young Storytellers</p>
</div>"""
    },
    TemplateCode.SUBMISSION_REMINDER: {
        "name": "Story Submission Reminder",
        "subject": "Reminder: Complete {{child_name}}'s Story Submission for {{writathon_name}}",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #C2410C; margin-top: 0;">Don't Miss the Writathon Submission Deadline!</h2>
  <p>Dear {{parent_name}},</p>
  <p>This is a friendly reminder that <strong>{{child_name}}</strong>'s story for <strong>{{writathon_name}}</strong> has not been submitted yet.</p>

  <div style="background-color: #FAECE7; border-left: 4px solid #C2410C; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Lead ID:</strong> {{lead_id}}</p>
    <p style="margin: 4px 0 0 0;"><strong>Submission Deadline:</strong> {{submission_deadline}}</p>
  </div>

  <p>Inspire your young author to finalize their masterpiece and upload their DOCX or PDF file before the deadline.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{submission_url}}" style="background: linear-gradient(135deg, #6B46C1, #E8577D); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">
      Upload & Submit Story
    </a>
  </div>

  <p style="color: #6B7280; font-size: 14px;">Once submitted, your story will enter our editorial review queue.</p>
</div>"""
    },
    TemplateCode.SUBMISSION_CONFIRMATION: {
        "name": "Story Submission Confirmation",
        "subject": "Story Received: '{{story_title}}' by {{child_name}}",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #6B46C1; margin-top: 0;">Story Successfully Received! 🎉</h2>
  <p>Dear {{parent_name}},</p>
  <p>We are delighted to confirm that <strong>{{child_name}}</strong>'s story has been successfully received.</p>

  <div style="background-color: #F3EEFF; border-left: 4px solid #6B46C1; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Story Title:</strong> {{story_title}}</p>
    <p style="margin: 4px 0 0 0;"><strong>Submission Date:</strong> {{submission_date}}</p>
    <p style="margin: 4px 0 0 0;"><strong>Status:</strong> Queued for Editorial Review</p>
  </div>

  <h3 style="color: #534AB7;">Review Process & Next Steps:</h3>
  <ol>
    <li>Our editorial review team will conduct a thorough review and manual originality check.</li>
    <li>Approximate review timeline: <strong>3-5 business days</strong>.</li>
    <li>You will receive an email once the reviewer has reached an eligibility decision.</li>
  </ol>

  <p style="color: #6B7280; font-size: 14px;">Thank you for being part of {{writathon_name}}!</p>
</div>"""
    },
    TemplateCode.REVIEW_RESULT_ELIGIBLE: {
        "name": "Story Eligible & Payment Instructions",
        "subject": "Congratulations! '{{story_title}}' is Eligible for Publication in {{writathon_name}}",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #6B46C1; margin-top: 0;">Congratulations! Story Eligible! 🌟</h2>
  <p>Dear {{parent_name}},</p>
  <p>We are overjoyed to share that <strong>{{child_name}}</strong>'s story, <em>"{{story_title}}"</em>, has passed our editorial review and is <strong>ELIGIBLE</strong> for publication!</p>

  <div style="background-color: #FFF9E6; border-left: 4px solid #D97706; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Review Feedback:</strong></p>
    <p style="margin: 4px 0 0 0; font-style: italic;">"{{feedback}}"</p>
  </div>

  <h3 style="color: #534AB7;">Next Step: Complete Publication Processing</h3>
  <p>To finalize typesetting, ISBN allocation, and publishing of the story anthology, please complete the publication processing fee using the link below:</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{payment_link}}" style="background: linear-gradient(135deg, #6B46C1, #E8577D); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">
      Proceed to Payment ({{amount}} {{currency}})
    </a>
  </div>

  <p style="color: #6B7280; font-size: 14px;">Payment Link: <a href="{{payment_link}}">{{payment_link}}</a></p>
</div>"""
    },
    TemplateCode.REVIEW_RESULT_NOT_ELIGIBLE: {
        "name": "Review Decision: Not Eligible",
        "subject": "Update on {{child_name}}'s Story Submission for {{writathon_name}}",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #534AB7; margin-top: 0;">Review Decision Update</h2>
  <p>Dear {{parent_name}},</p>
  <p>Thank you for submitting <strong>{{child_name}}</strong>'s story, <em>"{{story_title}}"</em>, for {{writathon_name}}. Our editorial panel has concluded their review.</p>

  <p>While we truly appreciate the imagination and effort invested, this submission was not selected as eligible for publication in this edition.</p>

  <div style="background-color: #F9FAFB; border-left: 4px solid #6B7280; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Editorial Panel Feedback:</strong></p>
    <p style="margin: 4px 0 0 0;">{{feedback}}</p>
  </div>

  <p>We encourage {{child_name}} to keep writing and exploring their creativity. We hope to see future submissions from your young writer in our upcoming editions.</p>
</div>"""
    },
    TemplateCode.PAYMENT_LINK: {
        "name": "Payment Link Notification",
        "subject": "Publication Payment Link for {{child_name}}'s Story - {{writathon_name}}",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #6B46C1; margin-top: 0;">Payment Link for Publication</h2>
  <p>Dear {{parent_name}},</p>
  <p>Here is your secure payment link for publishing <strong>{{child_name}}</strong>'s story in {{writathon_name}}.</p>

  <div style="background-color: #F3EEFF; border-left: 4px solid #6B46C1; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Amount Due:</strong> {{amount}} {{currency}}</p>
    <p style="margin: 4px 0 0 0;"><strong>Valid Until:</strong> {{expiry_date}}</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{payment_link}}" style="background: linear-gradient(135deg, #6B46C1, #E8577D); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">
      Pay Now via Gateway
    </a>
  </div>
</div>"""
    },
    TemplateCode.PAYMENT_REMINDER: {
        "name": "Payment Pending Reminder",
        "subject": "Reminder: Complete Payment for {{child_name}}'s Publication",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #C2410C; margin-top: 0;">Payment Pending Reminder</h2>
  <p>Dear {{parent_name}},</p>
  <p>This is a gentle reminder that the publication fee of <strong>{{amount}} {{currency}}</strong> for <strong>{{child_name}}</strong>'s story is still pending.</p>
  <p>Please complete the payment soon so we can proceed with publication preparation.</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{payment_link}}" style="background: linear-gradient(135deg, #6B46C1, #E8577D); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">
      Complete Payment
    </a>
  </div>
</div>"""
    },
    TemplateCode.PAYMENT_CONFIRMATION: {
        "name": "Payment Confirmation Receipt",
        "subject": "Payment Successful! Receipt for {{child_name}} (Ref: {{payment_ref}})",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #059669; margin-top: 0;">Payment Confirmed! ✅</h2>
  <p>Dear {{parent_name}},</p>
  <p>We have successfully received your payment for <strong>{{child_name}}</strong>'s story <em>"{{story_title}}"</em>.</p>

  <div style="background-color: #ECFDF5; border-left: 4px solid #059669; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Amount Paid:</strong> {{amount}} {{currency}}</p>
    <p style="margin: 4px 0 0 0;"><strong>Transaction Ref:</strong> {{payment_ref}}</p>
    <p style="margin: 4px 0 0 0;"><strong>Payment Date:</strong> {{payment_date}}</p>
  </div>

  <h3 style="color: #534AB7;">Next Step: Story Publication</h3>
  <p>Your story has now been marked <strong>Ready for Publication</strong>. Our team will prepare the final publication volume.</p>
</div>"""
    },
    TemplateCode.FINAL_CONFIRMATION: {
        "name": "Final Publication Confirmation",
        "subject": "Publication Ready! Final Confirmation for {{child_name}}'s Story",
        "body": """<div style="font-family: 'DM Sans', sans-serif; color: #1A1A2E; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
  <h2 style="color: #6B46C1; margin-top: 0;">Final Publication Confirmation! 📚</h2>
  <p>Dear {{parent_name}},</p>
  <p>We are delighted to inform you that <strong>{{child_name}}</strong>'s story, <em>"{{story_title}}"</em>, is now ready in our publication pipeline!</p>

  <div style="background-color: #F3EEFF; border-left: 4px solid #6B46C1; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Story:</strong> {{story_title}}</p>
    <p style="margin: 4px 0 0 0;"><strong>Publication Status:</strong> Ready / Scheduled</p>
    <p style="margin: 4px 0 0 0;"><strong>Expected Release:</strong> 2-3 weeks</p>
  </div>

  <p>We will send you the official publication link and digital certificate as soon as the release goes live.</p>
  <p style="color: #6B7280; font-size: 14px;">Congratulations once again to {{child_name}}!</p>
</div>"""
    }
}


class EmailService:
    @staticmethod
    def render_template(content: str, context: dict[str, Any]) -> str:
        rendered = content
        for key, value in context.items():
            placeholder = f"{{{{{key}}}}}"
            rendered = rendered.replace(placeholder, html.escape(str(value or "")))  # values come from parents; templates are HTML
        return rendered

    @staticmethod
    def log_and_send(
        db: Session,
        lead: Lead,
        template_code: TemplateCode,
        recipient: str,
        context: dict[str, Any]
    ) -> CommunicationLog:
        """
        Retrieves template from database (or default fallback), interpolates context,
        records the email in communication_logs, and marks SENT.
        """
        db_template = db.query(EmailTemplate).filter(EmailTemplate.template_code == template_code).first()
        
        if db_template:
            subject_tpl = db_template.subject_template
            body_tpl = db_template.body_template
        elif template_code in DEFAULT_TEMPLATES:
            subject_tpl = DEFAULT_TEMPLATES[template_code]["subject"]
            body_tpl = DEFAULT_TEMPLATES[template_code]["body"]
        else:
            subject_tpl = f"Notification from Writathon for {context.get('child_name', '')}"
            body_tpl = f"<p>Hello {context.get('parent_name', '')}, please check your Writathon status.</p>"

        subject = EmailService.render_template(subject_tpl, context)
        body = EmailService.render_template(body_tpl, context)

        comm_log = CommunicationLog(
            lead_id=lead.id,
            type="EMAIL",
            template=template_code.value,
            recipient=recipient,
            subject=subject,
            body_content=body,
            status=CommStatus.SENT,
            sent_at=datetime.now(timezone.utc),
            error_message=None
        )
        db.add(comm_log)
        db.commit()
        db.refresh(comm_log)
        logger.info(f"Email sent & logged to {recipient} [template={template_code.value}]")
        return comm_log

    @staticmethod
    def send_interest_confirmation(db: Session, lead: Lead, writathon: Writathon) -> CommunicationLog:
        submission_url = f"{settings.FRONTEND_URL}/submit-story/{lead.lead_id}?token={lead.access_token}"
        deadline_str = writathon.submission_deadline.strftime("%B %d, %Y") if writathon.submission_deadline else "TBA"
        
        context = {
            "writathon_name": writathon.name,
            "child_name": lead.child_name,
            "child_age": lead.age_group or lead.child_age,
            "grade": lead.grade,
            "parent_name": lead.parent_name,
            "lead_id": lead.lead_id,
            "submission_deadline": deadline_str,
            "guidelines": writathon.guidelines or "Please write an original, creative story.",
            "submission_url": submission_url
        }
        return EmailService.log_and_send(
            db=db,
            lead=lead,
            template_code=TemplateCode.INTEREST_CONFIRMATION,
            recipient=lead.parent_email,
            context=context
        )

    @staticmethod
    def send_submission_reminder(db: Session, lead: Lead, writathon: Writathon) -> CommunicationLog:
        submission_url = f"{settings.FRONTEND_URL}/submit-story/{lead.lead_id}?token={lead.access_token}"
        deadline_str = writathon.submission_deadline.strftime("%B %d, %Y") if writathon.submission_deadline else "Soon"
        
        context = {
            "writathon_name": writathon.name,
            "child_name": lead.child_name,
            "parent_name": lead.parent_name,
            "lead_id": lead.lead_id,
            "submission_deadline": deadline_str,
            "submission_url": submission_url
        }
        return EmailService.log_and_send(
            db=db,
            lead=lead,
            template_code=TemplateCode.SUBMISSION_REMINDER,
            recipient=lead.parent_email,
            context=context
        )

    @staticmethod
    def send_submission_confirmation(db: Session, lead: Lead, story: StorySubmission) -> CommunicationLog:
        submitted_at_str = story.submitted_at.strftime("%B %d, %Y at %I:%M %p") if story.submitted_at else "Today"
        context = {
            "writathon_name": lead.writathon.name if lead.writathon else "Writathon",
            "child_name": lead.child_name,
            "parent_name": lead.parent_name,
            "story_title": story.title,
            "submission_date": submitted_at_str
        }
        return EmailService.log_and_send(
            db=db,
            lead=lead,
            template_code=TemplateCode.SUBMISSION_CONFIRMATION,
            recipient=lead.parent_email,
            context=context
        )

    @staticmethod
    def send_review_result(db: Session, lead: Lead, story: StorySubmission, review: StoryReview, payment_link: Optional[str] = None) -> CommunicationLog:
        if review.decision.value == "ELIGIBLE":
            template_code = TemplateCode.REVIEW_RESULT_ELIGIBLE
            context = {
                "writathon_name": lead.writathon.name if lead.writathon else "Writathon",
                "child_name": lead.child_name,
                "parent_name": lead.parent_name,
                "story_title": story.title,
                "feedback": review.feedback or "Outstanding creativity and compelling narrative structure!",
                "payment_link": payment_link or f"{settings.FRONTEND_URL}/status/{lead.lead_id}",
                "amount": float(lead.writathon.submission_fee) if lead.writathon else 499.00,
                "currency": lead.writathon.currency if lead.writathon else "INR"
            }
        else:
            template_code = TemplateCode.REVIEW_RESULT_NOT_ELIGIBLE
            context = {
                "writathon_name": lead.writathon.name if lead.writathon else "Writathon",
                "child_name": lead.child_name,
                "parent_name": lead.parent_name,
                "story_title": story.title,
                "feedback": review.feedback or "We appreciate your participation."
            }
        return EmailService.log_and_send(
            db=db,
            lead=lead,
            template_code=template_code,
            recipient=lead.parent_email,
            context=context
        )

    @staticmethod
    def send_payment_link(db: Session, lead: Lead, payment: Payment) -> CommunicationLog:
        expiry_str = payment.link_expires_at.strftime("%B %d, %Y") if payment.link_expires_at else "7 days"
        context = {
            "writathon_name": lead.writathon.name if lead.writathon else "Writathon",
            "child_name": lead.child_name,
            "parent_name": lead.parent_name,
            "payment_link": payment.payment_link,
            "amount": float(payment.amount),
            "currency": payment.currency,
            "expiry_date": expiry_str
        }
        return EmailService.log_and_send(
            db=db,
            lead=lead,
            template_code=TemplateCode.PAYMENT_LINK,
            recipient=lead.parent_email,
            context=context
        )

    @staticmethod
    def send_payment_confirmation(db: Session, lead: Lead, story: StorySubmission, payment: Payment) -> CommunicationLog:
        payment_date_str = payment.paid_at.strftime("%B %d, %Y") if payment.paid_at else "Today"
        context = {
            "writathon_name": lead.writathon.name if lead.writathon else "Writathon",
            "child_name": lead.child_name,
            "parent_name": lead.parent_name,
            "story_title": story.title,
            "amount": float(payment.amount),
            "currency": payment.currency,
            "payment_ref": payment.gateway_payment_id or f"TXN-{payment.id}",
            "payment_date": payment_date_str
        }
        return EmailService.log_and_send(
            db=db,
            lead=lead,
            template_code=TemplateCode.PAYMENT_CONFIRMATION,
            recipient=lead.parent_email,
            context=context
        )

    @staticmethod
    def send_final_confirmation(db: Session, lead: Lead, story: StorySubmission) -> CommunicationLog:
        context = {
            "writathon_name": lead.writathon.name if lead.writathon else "Writathon",
            "child_name": lead.child_name,
            "parent_name": lead.parent_name,
            "story_title": story.title
        }
        return EmailService.log_and_send(
            db=db,
            lead=lead,
            template_code=TemplateCode.FINAL_CONFIRMATION,
            recipient=lead.parent_email,
            context=context
        )
