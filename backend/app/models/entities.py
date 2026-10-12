from datetime import datetime, timezone
import enum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, ForeignKey,
    Boolean, Numeric, Enum as SQLEnum, Index, JSON, func
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"
    PARENT = "PARENT"

class WritathonStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    SUBMISSIONS_CLOSED = "SUBMISSIONS_CLOSED"
    COMPLETED = "COMPLETED"

class LeadStatus(str, enum.Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    REMINDER_SENT = "REMINDER_SENT"
    STORY_SUBMITTED = "STORY_SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAID = "PAID"
    COMPLETED = "COMPLETED"

class StoryStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"

class PlagiarismStatus(str, enum.Enum):
    NOT_CHECKED = "NOT_CHECKED"
    PASS = "PASS"
    FLAGGED = "FLAGGED"

class ReviewDecision(str, enum.Enum):
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"

class PaymentStatus(str, enum.Enum):
    LINK_SENT = "LINK_SENT"
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"

class PublicationStatus(str, enum.Enum):
    NOT_READY = "NOT_READY"
    READY = "READY"
    PUBLISHED = "PUBLISHED"

class TemplateCode(str, enum.Enum):
    INTEREST_CONFIRMATION = "INTEREST_CONFIRMATION"
    SUBMISSION_REMINDER = "SUBMISSION_REMINDER"
    SUBMISSION_CONFIRMATION = "SUBMISSION_CONFIRMATION"
    REVIEW_RESULT_ELIGIBLE = "REVIEW_RESULT_ELIGIBLE"
    REVIEW_RESULT_NOT_ELIGIBLE = "REVIEW_RESULT_NOT_ELIGIBLE"
    PAYMENT_LINK = "PAYMENT_LINK"
    PAYMENT_REMINDER = "PAYMENT_REMINDER"
    PAYMENT_CONFIRMATION = "PAYMENT_CONFIRMATION"
    FINAL_CONFIRMATION = "FINAL_CONFIRMATION"

class CommStatus(str, enum.Enum):
    SENT = "SENT"
    FAILED = "FAILED"
    PENDING = "PENDING"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.STAFF, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    plagiarism_reviews = relationship("ManualPlagiarismReview", back_populates="reviewer")
    story_reviews = relationship("StoryReview", back_populates="reviewer")
    publications = relationship("Publication", back_populates="publisher")


class Writathon(Base):
    __tablename__ = "writathons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    submission_deadline = Column(DateTime, nullable=False)
    guidelines = Column(Text, nullable=True)
    submission_fee = Column(Numeric(10, 2), default=499.00, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    status = Column(SQLEnum(WritathonStatus), default=WritathonStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    leads = relationship("Lead", back_populates="writathon", cascade="all, delete-orphan")


class Student(Base):
    """One child (+ parent contact). Each Writathon they join is a Lead row (a registration)."""
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    parent_name = Column(String(255), nullable=False)
    parent_email = Column(String(255), nullable=False, index=True)  # stored lowercase
    parent_phone = Column(String(50), nullable=False)
    child_name = Column(String(255), nullable=False)
    child_dob = Column(Date, nullable=True)
    school = Column(String(255), nullable=False)
    grade = Column(String(50), nullable=False)
    country = Column(String(100), default="India", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    leads = relationship("Lead", back_populates="student")

    # Same parent email + child name = same student; enforced in the DB so concurrent registrations can't duplicate
    __table_args__ = (Index("uq_student_identity", "parent_email", func.lower(child_name), unique=True),)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(String(50), unique=True, index=True, nullable=False)  # WR-2026-000123
    writathon_id = Column(Integer, ForeignKey("writathons.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    parent_name = Column(String(255), nullable=False)
    parent_email = Column(String(255), nullable=False, index=True)
    parent_phone = Column(String(50), nullable=False)
    child_name = Column(String(255), nullable=False)
    child_dob = Column(Date, nullable=True)
    child_age = Column(Integer, nullable=True)  # older registrations; the form now asks for age_group
    age_group = Column(String(20), nullable=True)  # 8-10 / 11-13 / 14-18
    submission_category = Column(String(50), nullable=True)  # Short Story / Poem / Novella / Comics
    city = Column(String(100), nullable=True)
    school = Column(String(255), nullable=False)
    grade = Column(String(50), nullable=False)
    country = Column(String(100), default="India", nullable=False)
    status = Column(SQLEnum(LeadStatus), default=LeadStatus.NEW, nullable=False, index=True)
    source = Column(String(100), default="WEBSITE", nullable=False)
    access_token = Column(String(100), unique=True, index=True, nullable=False)
    reminder_count = Column(Integer, default=0, nullable=False)
    last_reminder_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    writathon = relationship("Writathon", back_populates="leads")
    student = relationship("Student", back_populates="leads")
    owner = relationship("User")
    submissions = relationship("StorySubmission", back_populates="lead", cascade="all, delete-orphan")
    communications = relationship("CommunicationLog", back_populates="lead", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="lead", cascade="all, delete-orphan")

    # One registration per student per Writathon (also stops concurrent duplicate registrations)
    __table_args__ = (Index("uq_lead_writathon_student", "writathon_id", "student_id", unique=True),)

    @property
    def writathon_name(self):
        return self.writathon.name if self.writathon else None

    @property
    def owner_name(self):
        return self.owner.full_name if self.owner else None

    @property
    def submission_status(self):
        return self.submissions[0].status if self.submissions else None


class StorySubmission(Base):
    __tablename__ = "story_submissions"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)  # DOCX or PDF
    file_size = Column(Integer, nullable=False)
    word_count = Column(Integer, nullable=True)
    category = Column(String(100), nullable=True)
    originality_declaration = Column(Boolean, default=True, nullable=False)
    status = Column(SQLEnum(StoryStatus), default=StoryStatus.SUBMITTED, nullable=False, index=True)
    submitted_at = Column(DateTime, default=utcnow, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="submissions")
    plagiarism_review = relationship("ManualPlagiarismReview", back_populates="story", uselist=False, cascade="all, delete-orphan")
    review = relationship("StoryReview", back_populates="story", uselist=False, cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="story", cascade="all, delete-orphan")
    publication = relationship("Publication", back_populates="story", uselist=False, cascade="all, delete-orphan")


class ManualPlagiarismReview(Base):
    __tablename__ = "manual_plagiarism_reviews"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("story_submissions.id"), nullable=False, unique=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(SQLEnum(PlagiarismStatus), default=PlagiarismStatus.NOT_CHECKED, nullable=False)
    plagiarism_notes = Column(Text, nullable=True)
    reference_sources = Column(Text, nullable=True)
    checked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    story = relationship("StorySubmission", back_populates="plagiarism_review")
    reviewer = relationship("User", back_populates="plagiarism_reviews")


class StoryReview(Base):
    __tablename__ = "story_reviews"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("story_submissions.id"), nullable=False, unique=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decision = Column(SQLEnum(ReviewDecision), nullable=False)
    feedback = Column(Text, nullable=True)  # Mandatory if not eligible
    internal_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, default=utcnow, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    story = relationship("StorySubmission", back_populates="review")
    reviewer = relationship("User", back_populates="story_reviews")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    story_id = Column(Integer, ForeignKey("story_submissions.id"), nullable=False, index=True)
    gateway = Column(String(50), default="RAZORPAY", nullable=False)
    gateway_payment_id = Column(String(100), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.LINK_SENT, nullable=False, index=True)
    payment_link = Column(String(500), nullable=False)
    payment_link_token = Column(String(100), unique=True, index=True, nullable=False)
    link_expires_at = Column(DateTime, nullable=False)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="payments")
    story = relationship("StorySubmission", back_populates="payments")


class Publication(Base):
    __tablename__ = "publications"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("story_submissions.id"), nullable=False, unique=True, index=True)
    publisher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    publication_status = Column(SQLEnum(PublicationStatus), default=PublicationStatus.NOT_READY, nullable=False)
    publication_url = Column(String(500), nullable=True)
    publication_notes = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    story = relationship("StorySubmission", back_populates="publication")
    publisher = relationship("User", back_populates="publications")


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    template_code = Column(SQLEnum(TemplateCode), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    subject_template = Column(String(255), nullable=False)
    body_template = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class CommunicationLog(Base):
    __tablename__ = "communication_logs"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    type = Column(String(50), default="EMAIL", nullable=False)
    template = Column(String(100), nullable=False)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body_content = Column(Text, nullable=False)
    status = Column(SQLEnum(CommStatus), default=CommStatus.SENT, nullable=False)
    sent_at = Column(DateTime, default=utcnow, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="communications")


class AuditLog(Base):
    """Append-only record of staff/system actions. No API updates or deletes these rows."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # null = system/public action
    action = Column(String(100), nullable=False, index=True)  # e.g. lead.assign, review.decision
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    changes = Column(JSON, nullable=True)  # {"field": [old, new]}
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    user = relationship("User")
