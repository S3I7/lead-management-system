import os
from datetime import datetime, timezone, timedelta, date
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.entities import (
    User, UserRole, Writathon, WritathonStatus,
    Lead, LeadStatus, StorySubmission, StoryStatus,
    ManualPlagiarismReview, PlagiarismStatus,
    StoryReview, ReviewDecision,
    Payment, PaymentStatus,
    Publication, PublicationStatus,
    EmailTemplate, TemplateCode,
    CommunicationLog, CommStatus
)
from app.services.email_service import DEFAULT_TEMPLATES

def seed_database(db: Session):
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    # 1. First admin from env (production); demo users only in DEMO_MODE
    if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD and not db.query(User).filter(User.role == UserRole.ADMIN).first():
        db.add(User(email=settings.ADMIN_EMAIL.lower(), hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                    full_name="Administrator", role=UserRole.ADMIN, is_active=True))
        db.commit()

    # 2. Email Templates
    for code, tpl in DEFAULT_TEMPLATES.items():
        existing = db.query(EmailTemplate).filter(EmailTemplate.template_code == code).first()
        if not existing:
            new_t = EmailTemplate(
                template_code=code,
                name=tpl["name"],
                subject_template=tpl["subject"],
                body_template=tpl["body"],
                is_active=True
            )
            db.add(new_t)
    db.commit()

    if settings.DEMO_MODE:
        seed_demo_data(db)

    # Link registrations created before students existed (and demo leads) to a Student
    from app.api.leads import get_or_create_student
    for lead in db.query(Lead).filter(Lead.student_id.is_(None)).all():
        lead.student_id = get_or_create_student(
            db, parent_name=lead.parent_name, parent_email=lead.parent_email, parent_phone=lead.parent_phone,
            child_name=lead.child_name, child_dob=lead.child_dob, school=lead.school, grade=lead.grade,
            country=lead.country).id
    db.commit()


def seed_demo_data(db: Session):
    # 1. Users
    admin_user = db.query(User).filter(User.email == "admin@writathon.com").first()
    if not admin_user:
        admin_user = User(
            email="admin@writathon.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Chief Administrator",
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin_user)

    staff_user = db.query(User).filter(User.email == "reviewer@writathon.com").first()
    if not staff_user:
        staff_user = User(
            email="reviewer@writathon.com",
            hashed_password=get_password_hash("staff123"),
            full_name="Sarah Jenkins (Editorial Staff)",
            role=UserRole.STAFF,
            is_active=True
        )
        db.add(staff_user)

    parent_user = db.query(User).filter(User.email == "parent@example.com").first()
    if not parent_user:
        parent_user = User(
            email="parent@example.com",
            hashed_password=get_password_hash("parent123"),
            full_name="Rajesh Sharma",
            role=UserRole.PARENT,
            is_active=True
        )
        db.add(parent_user)

    db.commit()
    db.refresh(admin_user)
    db.refresh(staff_user)

    # 3. Writathon Campaign
    writathon = db.query(Writathon).filter(Writathon.code == "WR2026").first()
    now = datetime.now(timezone.utc)
    if not writathon:
        writathon = Writathon(
            name="Writathon 2026: Young Authors Festival",
            code="WR2026",
            description="The premier national creative writing competition empowering children aged 6-16 to publish their very first book chapter or short story.",
            start_date=now - timedelta(days=20),
            end_date=now + timedelta(days=60),
            submission_deadline=now + timedelta(days=30),
            guidelines="1. Word count: 300 to 1,500 words.\n2. Formats: PDF or DOCX.\n3. The story must be 100% original work produced by the child.\n4. Themes: The Secret Door, A Journey Through Space, or The Whispering Forest.",
            submission_fee=499.00,
            currency="INR",
            status=WritathonStatus.ACTIVE
        )
        db.add(writathon)
        db.commit()
        db.refresh(writathon)

    # Create dummy sample story file in uploads for demo downloads
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    sample_pdf_path = os.path.join(settings.UPLOAD_DIR, "sample_story.pdf")
    if not os.path.exists(sample_pdf_path):
        with open(sample_pdf_path, "wb") as f:
            f.write(b"%PDF-1.4\n1 0 obj\n<< /Title (The Magic Compass) /Author (Aarav Sharma) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF")

    # 4. Seed Leads across all pipeline stages if leads are empty
    if db.query(Lead).count() == 0:
        # Lead 1: CONTACTED
        lead1 = Lead(
            lead_id="WR-2026-000101",
            writathon_id=writathon.id,
            parent_name="Rajesh Sharma",
            parent_email="parent@example.com",
            parent_phone="+91 98765 43210",
            child_name="Aarav Sharma",
            child_dob=date(2015, 4, 12),
            child_age=11,
            school="Delhi Public School, R.K. Puram",
            grade="Grade 6",
            country="India",
            status=LeadStatus.CONTACTED,
            source="WEBSITE",
            access_token="tok_aarav_sharma_101",
            reminder_count=0,
            created_at=now - timedelta(days=2)
        )
        db.add(lead1)
        db.flush()
        db.add(CommunicationLog(
            lead_id=lead1.id,
            type="EMAIL",
            template="INTEREST_CONFIRMATION",
            recipient=lead1.parent_email,
            subject=f"Welcome to {writathon.name}! Registration Confirmed for {lead1.child_name}",
            body_content="<p>Welcome email sent to parent.</p>",
            status=CommStatus.SENT,
            sent_at=now - timedelta(days=2)
        ))

        # Lead 2: REMINDER_SENT
        lead2 = Lead(
            lead_id="WR-2026-000102",
            writathon_id=writathon.id,
            parent_name="Ananya Iyer",
            parent_email="ananya.iyer@gmail.com",
            parent_phone="+91 98451 23456",
            child_name="Rhea Iyer",
            child_dob=date(2016, 8, 22),
            child_age=10,
            school="National Public School, Indiranagar",
            grade="Grade 5",
            country="India",
            status=LeadStatus.REMINDER_SENT,
            source="WEBSITE",
            access_token="tok_rhea_iyer_102",
            reminder_count=1,
            last_reminder_sent_at=now - timedelta(days=1),
            created_at=now - timedelta(days=4)
        )
        db.add(lead2)
        db.flush()
        db.add(CommunicationLog(
            lead_id=lead2.id,
            type="EMAIL",
            template="SUBMISSION_REMINDER",
            recipient=lead2.parent_email,
            subject=f"Reminder: Complete {lead2.child_name}'s Story Submission",
            body_content="<p>Reminder email day 3 sent.</p>",
            status=CommStatus.SENT,
            sent_at=now - timedelta(days=1)
        ))

        # Lead 3: STORY_SUBMITTED
        lead3 = Lead(
            lead_id="WR-2026-000103",
            writathon_id=writathon.id,
            parent_name="Vikram Reddy",
            parent_email="vikram.reddy@outlook.com",
            parent_phone="+91 97110 56789",
            child_name="Vihaan Reddy",
            child_dob=date(2014, 11, 5),
            child_age=12,
            school="Oakridge International School",
            grade="Grade 7",
            country="India",
            status=LeadStatus.STORY_SUBMITTED,
            source="WEBSITE",
            access_token="tok_vihaan_reddy_103",
            created_at=now - timedelta(days=6)
        )
        db.add(lead3)
        db.flush()
        story3 = StorySubmission(
            lead_id=lead3.id,
            title="The Chronicles of the Starlight Compass",
            file_url="/api/v1/submissions/files/sample_story.pdf",
            file_name="Chronicles_of_Starlight.pdf",
            file_type="application/pdf",
            file_size=1024 * 45,
            word_count=820,
            category="Fantasy & Adventure",
            originality_declaration=True,
            status=StoryStatus.SUBMITTED,
            submitted_at=now - timedelta(days=1)
        )
        db.add(story3)
        db.flush()
        db.add(ManualPlagiarismReview(
            story_id=story3.id,
            status=PlagiarismStatus.NOT_CHECKED
        ))
        db.add(CommunicationLog(
            lead_id=lead3.id,
            type="EMAIL",
            template="SUBMISSION_CONFIRMATION",
            recipient=lead3.parent_email,
            subject=f"Story Received: '{story3.title}' by {lead3.child_name}",
            body_content="<p>Story received confirmation email.</p>",
            status=CommStatus.SENT,
            sent_at=now - timedelta(days=1)
        ))

        # Lead 4: UNDER_REVIEW with manual plagiarism check PASS
        lead4 = Lead(
            lead_id="WR-2026-000104",
            writathon_id=writathon.id,
            parent_name="Sunita Gupta",
            parent_email="sunita.gupta@yahoo.com",
            parent_phone="+91 99201 33445",
            child_name="Saanvi Gupta",
            child_dob=date(2017, 3, 19),
            child_age=9,
            school="The Heritage School, Rohini",
            grade="Grade 4",
            country="India",
            status=LeadStatus.UNDER_REVIEW,
            source="WEBSITE",
            access_token="tok_saanvi_gupta_104",
            created_at=now - timedelta(days=8)
        )
        db.add(lead4)
        db.flush()
        story4 = StorySubmission(
            lead_id=lead4.id,
            title="When the Whispering Tree Spoke",
            file_url="/api/v1/submissions/files/sample_story.pdf",
            file_name="Whispering_Tree.pdf",
            file_type="application/pdf",
            file_size=1024 * 60,
            word_count=650,
            category="Fable & Moral",
            originality_declaration=True,
            status=StoryStatus.UNDER_REVIEW,
            submitted_at=now - timedelta(days=3)
        )
        db.add(story4)
        db.flush()
        db.add(ManualPlagiarismReview(
            story_id=story4.id,
            reviewer_id=staff_user.id,
            status=PlagiarismStatus.PASS,
            plagiarism_notes="Manually cross-checked against standard online archives. 100% original child voice and vocabulary.",
            reference_sources="Google Search, Turnitin manual database match, Archive.org",
            checked_at=now - timedelta(hours=6)
        ))

        # Lead 5: ELIGIBLE / PAYMENT_PENDING
        lead5 = Lead(
            lead_id="WR-2026-000105",
            writathon_id=writathon.id,
            parent_name="Manoj Verma",
            parent_email="manoj.verma@corp.com",
            parent_phone="+91 98102 77889",
            child_name="Rohan Verma",
            child_dob=date(2015, 6, 14),
            child_age=11,
            school="Modern School, Barakhamba Road",
            grade="Grade 6",
            country="India",
            status=LeadStatus.PAYMENT_PENDING,
            source="WEBSITE",
            access_token="tok_rohan_verma_105",
            created_at=now - timedelta(days=10)
        )
        db.add(lead5)
        db.flush()
        story5 = StorySubmission(
            lead_id=lead5.id,
            title="The Clockwork Dragonfly",
            file_url="/api/v1/submissions/files/sample_story.pdf",
            file_name="Clockwork_Dragonfly.pdf",
            file_type="application/pdf",
            file_size=1024 * 72,
            word_count=940,
            category="Sci-Fi & Steampunk",
            originality_declaration=True,
            status=StoryStatus.ELIGIBLE,
            submitted_at=now - timedelta(days=5)
        )
        db.add(story5)
        db.flush()
        db.add(ManualPlagiarismReview(
            story_id=story5.id,
            reviewer_id=staff_user.id,
            status=PlagiarismStatus.PASS,
            plagiarism_notes="Original imaginative plot, no matching web records.",
            reference_sources="Internal database + manual search",
            checked_at=now - timedelta(days=2)
        ))
        db.add(StoryReview(
            story_id=story5.id,
            reviewer_id=staff_user.id,
            decision=ReviewDecision.ELIGIBLE,
            feedback="Superb steampunk world-building and character design. Strong contender for front anthology feature!",
            internal_notes="Recommended for young author spotlight.",
            reviewed_at=now - timedelta(days=2)
        ))
        payment5_token = "pay_tok_rohan_105"
        db.add(Payment(
            lead_id=lead5.id,
            story_id=story5.id,
            gateway="RAZORPAY",
            gateway_payment_id="order_mno9827364",
            amount=499.00,
            currency="INR",
            status=PaymentStatus.LINK_SENT,
            payment_link=f"{settings.FRONTEND_URL}/payment/{payment5_token}",
            payment_link_token=payment5_token,
            link_expires_at=now + timedelta(days=5)
        ))
        db.add(CommunicationLog(
            lead_id=lead5.id,
            type="EMAIL",
            template="REVIEW_RESULT_ELIGIBLE",
            recipient=lead5.parent_email,
            subject=f"Congratulations! '{story5.title}' is Eligible for Publication",
            body_content="<p>Story eligible email with payment link sent.</p>",
            status=CommStatus.SENT,
            sent_at=now - timedelta(days=2)
        ))

        # Lead 6: NOT_ELIGIBLE with feedback
        lead6 = Lead(
            lead_id="WR-2026-000106",
            writathon_id=writathon.id,
            parent_name="Kavita Mehta",
            parent_email="kavita.mehta@gmail.com",
            parent_phone="+91 98205 11223",
            child_name="Kabir Mehta",
            child_dob=date(2013, 9, 30),
            child_age=13,
            school="Bombay Scottish School",
            grade="Grade 8",
            country="India",
            status=LeadStatus.NOT_ELIGIBLE,
            source="WEBSITE",
            access_token="tok_kabir_mehta_106",
            created_at=now - timedelta(days=12)
        )
        db.add(lead6)
        db.flush()
        story6 = StorySubmission(
            lead_id=lead6.id,
            title="The Lost Galaxy",
            file_url="/api/v1/submissions/files/sample_story.pdf",
            file_name="Lost_Galaxy.pdf",
            file_type="application/pdf",
            file_size=1024 * 35,
            word_count=210,
            category="Space Fiction",
            originality_declaration=True,
            status=StoryStatus.NOT_ELIGIBLE,
            submitted_at=now - timedelta(days=7)
        )
        db.add(story6)
        db.flush()
        db.add(ManualPlagiarismReview(
            story_id=story6.id,
            reviewer_id=staff_user.id,
            status=PlagiarismStatus.PASS,
            plagiarism_notes="Pass originality check, however below the mandatory 300 words guideline.",
            reference_sources="Manual review",
            checked_at=now - timedelta(days=4)
        ))
        db.add(StoryReview(
            story_id=story6.id,
            reviewer_id=staff_user.id,
            decision=ReviewDecision.NOT_ELIGIBLE,
            feedback="The premise has great potential, but the story did not meet the minimum length threshold (210 words vs 300 words required) and ended abruptly without story resolution.",
            internal_notes="Word count too short.",
            reviewed_at=now - timedelta(days=4)
        ))
        db.add(CommunicationLog(
            lead_id=lead6.id,
            type="EMAIL",
            template="REVIEW_RESULT_NOT_ELIGIBLE",
            recipient=lead6.parent_email,
            subject=f"Update on {lead6.child_name}'s Story Submission",
            body_content="<p>Review feedback email explaining ineligibility sent.</p>",
            status=CommStatus.SENT,
            sent_at=now - timedelta(days=4)
        ))

        # Lead 7: COMPLETED (Paid & Ready for Publication)
        lead7 = Lead(
            lead_id="WR-2026-000107",
            writathon_id=writathon.id,
            parent_name="Deepak Sen",
            parent_email="deepak.sen@tech.in",
            parent_phone="+91 99003 44556",
            child_name="Meera Sen",
            child_dob=date(2016, 1, 10),
            child_age=10,
            school="Sanskriti School, Chanakyapuri",
            grade="Grade 5",
            country="India",
            status=LeadStatus.COMPLETED,
            source="WEBSITE",
            access_token="tok_meera_sen_107",
            created_at=now - timedelta(days=15)
        )
        db.add(lead7)
        db.flush()
        story7 = StorySubmission(
            lead_id=lead7.id,
            title="The Song of the Silver Dolphin",
            file_url="/api/v1/submissions/files/sample_story.pdf",
            file_name="Silver_Dolphin.pdf",
            file_type="application/pdf",
            file_size=1024 * 88,
            word_count=1100,
            category="Ocean Tales",
            originality_declaration=True,
            status=StoryStatus.APPROVED,
            submitted_at=now - timedelta(days=10)
        )
        db.add(story7)
        db.flush()
        db.add(ManualPlagiarismReview(
            story_id=story7.id,
            reviewer_id=staff_user.id,
            status=PlagiarismStatus.PASS,
            plagiarism_notes="Pass originality check. Heartwarming prose.",
            reference_sources="Manual web checks",
            checked_at=now - timedelta(days=7)
        ))
        db.add(StoryReview(
            story_id=story7.id,
            reviewer_id=staff_user.id,
            decision=ReviewDecision.ELIGIBLE,
            feedback="Beautiful lyrical style, lyrical imagery, perfectly paced.",
            reviewed_at=now - timedelta(days=7)
        ))
        db.add(Payment(
            lead_id=lead7.id,
            story_id=story7.id,
            gateway="RAZORPAY",
            gateway_payment_id="pay_RZP9928172901",
            amount=499.00,
            currency="INR",
            status=PaymentStatus.PAID,
            payment_link=f"{settings.FRONTEND_URL}/payment/pay_tok_meera_107",
            payment_link_token="pay_tok_meera_107",
            link_expires_at=now + timedelta(days=7),
            paid_at=now - timedelta(days=5)
        ))
        db.add(Publication(
            story_id=story7.id,
            publisher_id=staff_user.id,
            publication_status=PublicationStatus.READY,
            publication_notes="Editorial layout completed. Assigned to Anthology Volume 1."
        ))
        db.add(CommunicationLog(
            lead_id=lead7.id,
            type="EMAIL",
            template="FINAL_CONFIRMATION",
            recipient=lead7.parent_email,
            subject=f"Publication Ready! Final Confirmation for {lead7.child_name}'s Story",
            body_content="<p>Final confirmation email sent.</p>",
            status=CommStatus.SENT,
            sent_at=now - timedelta(days=5)
        ))

        # Lead 8: PUBLISHED
        lead8 = Lead(
            lead_id="WR-2026-000108",
            writathon_id=writathon.id,
            parent_name="Praveen Nair",
            parent_email="praveen.nair@icloud.com",
            parent_phone="+91 97412 88990",
            child_name="Diya Nair",
            child_dob=date(2014, 5, 2),
            child_age=12,
            school="The Valley School, Bengaluru",
            grade="Grade 7",
            country="India",
            status=LeadStatus.COMPLETED,
            source="WEBSITE",
            access_token="tok_diya_nair_108",
            created_at=now - timedelta(days=18)
        )
        db.add(lead8)
        db.flush()
        story8 = StorySubmission(
            lead_id=lead8.id,
            title="Beyond the Cloud Kingdom",
            file_url="/api/v1/submissions/files/sample_story.pdf",
            file_name="Cloud_Kingdom.pdf",
            file_type="application/pdf",
            file_size=1024 * 95,
            word_count=1350,
            category="Sky Fantasy",
            originality_declaration=True,
            status=StoryStatus.PUBLISHED,
            submitted_at=now - timedelta(days=14)
        )
        db.add(story8)
        db.flush()
        db.add(ManualPlagiarismReview(
            story_id=story8.id,
            reviewer_id=staff_user.id,
            status=PlagiarismStatus.PASS,
            plagiarism_notes="Pass. Completely unique conceptualization.",
            reference_sources="Manual check",
            checked_at=now - timedelta(days=12)
        ))
        db.add(StoryReview(
            story_id=story8.id,
            reviewer_id=staff_user.id,
            decision=ReviewDecision.ELIGIBLE,
            feedback="Exceptional maturity in storytelling and atmospheric description.",
            reviewed_at=now - timedelta(days=12)
        ))
        db.add(Payment(
            lead_id=lead8.id,
            story_id=story8.id,
            gateway="RAZORPAY",
            gateway_payment_id="pay_RZP8877112233",
            amount=499.00,
            currency="INR",
            status=PaymentStatus.PAID,
            payment_link=f"{settings.FRONTEND_URL}/payment/pay_tok_diya_108",
            payment_link_token="pay_tok_diya_108",
            link_expires_at=now + timedelta(days=7),
            paid_at=now - timedelta(days=10)
        ))
        db.add(Publication(
            story_id=story8.id,
            publisher_id=admin_user.id,
            publication_status=PublicationStatus.PUBLISHED,
            publication_url="https://writathon.org/publications/2026/beyond-the-cloud-kingdom",
            publication_notes="Published in Volume 1, ISBN 978-3-16-148410-0",
            published_at=now - timedelta(days=3)
        ))
        db.add(CommunicationLog(
            lead_id=lead8.id,
            type="EMAIL",
            template="FINAL_CONFIRMATION",
            recipient=lead8.parent_email,
            subject=f"Published! Certificate & Anthology Link for {lead8.child_name}",
            body_content="<p>Publication completed announcement sent.</p>",
            status=CommStatus.SENT,
            sent_at=now - timedelta(days=3)
        ))

        db.commit()
        print("Database seeded with sample users, campaign, templates, and leads across all journey stages!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
