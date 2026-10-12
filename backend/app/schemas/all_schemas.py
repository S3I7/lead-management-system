from datetime import datetime, date
from typing import Optional, List, Any, Literal
from pydantic import BaseModel, EmailStr, Field, model_validator
from app.models.entities import (
    UserRole, WritathonStatus, LeadStatus, StoryStatus,
    PlagiarismStatus, ReviewDecision, PaymentStatus, PublicationStatus,
    TemplateCode, CommStatus
)

# --- User & Auth Schemas ---
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.STAFF

# --- Writathon Schemas ---
class WritathonBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    submission_deadline: datetime
    guidelines: Optional[str] = None
    submission_fee: float = 499.00
    currency: str = "INR"
    status: WritathonStatus = WritathonStatus.ACTIVE

class WritathonCreate(WritathonBase):
    submission_fee: float = Field(499.00, ge=0)

    @model_validator(mode="after")
    def check_dates(self):
        if not (self.start_date <= self.submission_deadline <= self.end_date):
            raise ValueError("Dates must satisfy start_date <= submission_deadline <= end_date.")
        return self

class WritathonUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    submission_deadline: Optional[datetime] = None
    guidelines: Optional[str] = None
    submission_fee: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    status: Optional[WritathonStatus] = None

class WritathonOut(WritathonBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Lead & Interest Form Schemas ---
class InterestFormSubmit(BaseModel):
    writathon_id: int
    child_name: str = Field(..., min_length=2, max_length=255)
    child_dob: Optional[date] = None
    child_age: Optional[int] = Field(None, ge=4, le=18)
    age_group: Literal["8-10", "11-13", "14-18"]
    submission_category: Literal["Short Story", "Poem", "Novella", "Comics"]
    grade: str = Field(..., min_length=1, max_length=50)
    school: str = Field(..., min_length=2, max_length=255)
    parent_name: str = Field(..., min_length=2, max_length=255)
    parent_email: EmailStr
    parent_phone: str = Field(..., min_length=7, max_length=25)
    city: str = Field(..., min_length=2, max_length=100)
    country: str = "India"
    terms_accepted: bool = Field(..., description="Must accept terms and conditions")

class LeadOut(BaseModel):
    id: int
    lead_id: str
    writathon_id: int
    writathon_name: Optional[str] = None
    parent_name: str
    parent_email: str
    parent_phone: str
    child_name: str
    child_dob: Optional[date] = None
    child_age: Optional[int] = None
    age_group: Optional[str] = None
    submission_category: Optional[str] = None
    city: Optional[str] = None
    school: str
    grade: str
    country: str
    status: LeadStatus
    source: str
    access_token: str
    student_id: Optional[int] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    submission_status: Optional[StoryStatus] = None
    reminder_count: int
    last_reminder_sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Story Submission Schemas ---
class StorySubmissionOut(BaseModel):
    id: int
    lead_id: int
    title: str
    file_url: str
    file_name: str
    file_type: str
    file_size: int
    word_count: Optional[int] = None
    category: Optional[str] = None
    originality_declaration: bool
    status: StoryStatus
    submitted_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# --- Plagiarism Review Schemas ---
class PlagiarismReviewSubmit(BaseModel):
    status: PlagiarismStatus
    plagiarism_notes: Optional[str] = Field(None, max_length=10000)
    reference_sources: Optional[str] = Field(None, max_length=10000)

class PlagiarismReviewOut(BaseModel):
    id: int
    story_id: int
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    status: PlagiarismStatus
    plagiarism_notes: Optional[str] = None
    reference_sources: Optional[str] = None
    checked_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Staff Review Schemas ---
class StoryReviewSubmit(BaseModel):
    decision: ReviewDecision
    feedback: Optional[str] = Field(None, max_length=10000)  # Mandatory if NOT_ELIGIBLE; sent to the parent
    internal_notes: Optional[str] = Field(None, max_length=10000)  # staff only

class StoryReviewOut(BaseModel):
    id: int
    story_id: int
    reviewer_id: int
    reviewer_name: Optional[str] = None
    decision: ReviewDecision
    feedback: Optional[str] = None
    internal_notes: Optional[str] = None
    reviewed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# --- Payment Schemas ---
class PaymentGenerateRequest(BaseModel):
    gateway: Optional[str] = "RAZORPAY"
    amount: Optional[float] = None  # if null, use writathon default fee

class PaymentOut(BaseModel):
    id: int
    lead_id: int
    story_id: int
    gateway: str
    gateway_payment_id: Optional[str] = None
    amount: float
    currency: str
    status: PaymentStatus
    payment_link: str
    payment_link_token: str
    link_expires_at: datetime
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PaymentProcessRequest(BaseModel):
    payment_method: str = "CARD"  # CARD, UPI, NETBANKING
    mock_success: bool = True
    transaction_ref: Optional[str] = None

class PaymentWebhookPayload(BaseModel):
    event: str
    payment_link_token: str
    gateway_payment_id: str
    amount: float
    status: str
    currency: Optional[str] = None

# --- Publication Schemas ---
class PublicationUpdate(BaseModel):
    publication_status: PublicationStatus
    # shown to parents as a link, so only http(s) (no javascript: URLs)
    publication_url: Optional[str] = Field(None, max_length=500, pattern=r"^(https?://\S+)?$")
    publication_notes: Optional[str] = Field(None, max_length=5000)

class PublicationOut(BaseModel):
    id: int
    story_id: int
    publisher_id: Optional[int] = None
    publisher_name: Optional[str] = None
    publication_status: PublicationStatus
    publication_url: Optional[str] = None
    publication_notes: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Communication Log & Template Schemas ---
class CommunicationLogOut(BaseModel):
    id: int
    lead_id: int
    type: str
    template: str
    recipient: str
    subject: str
    body_content: str
    status: CommStatus
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class EmailTemplateOut(BaseModel):
    id: int
    template_code: TemplateCode
    name: str
    subject_template: str
    body_template: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    is_active: Optional[bool] = None

class TemplatePreviewRequest(BaseModel):
    template_code: TemplateCode
    sample_context: Optional[dict[str, Any]] = None

# --- Comprehensive Lead Detail View ---
class LeadDetailOut(BaseModel):
    lead: LeadOut
    writathon: WritathonOut
    submission: Optional[StorySubmissionOut] = None
    plagiarism_review: Optional[PlagiarismReviewOut] = None
    story_review: Optional[StoryReviewOut] = None
    payment: Optional[PaymentOut] = None
    publication: Optional[PublicationOut] = None
    communications: List[CommunicationLogOut] = []

class LeadBulkUpdate(BaseModel):
    lead_ids: List[int] = Field(..., min_length=1, max_length=1000)
    owner_id: Optional[int] = None  # only applied when sent; null unassigns
    status: Optional[LeadStatus] = None  # only the manual pre-submission statuses, see MANUAL_LEAD_STATUSES

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    changes: Optional[dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Public (tracking ID) view: what a parent may see. No phone, internal notes, email bodies, file URLs or tokens. ---
class PublicLeadOut(BaseModel):
    lead_id: str
    writathon_id: int
    writathon_name: Optional[str] = None
    parent_name: str
    parent_email: str  # masked
    child_name: str
    child_age: Optional[int] = None
    age_group: Optional[str] = None
    submission_category: Optional[str] = None
    school: str
    grade: str
    status: LeadStatus
    submission_status: Optional[StoryStatus] = None
    created_at: datetime

class PublicSubmissionOut(BaseModel):
    title: str
    file_name: str
    category: Optional[str] = None
    word_count: Optional[int] = None
    status: StoryStatus
    submitted_at: datetime

class PublicPlagiarismOut(BaseModel):
    status: PlagiarismStatus

class PublicReviewOut(BaseModel):
    decision: ReviewDecision
    feedback: Optional[str] = None
    reviewed_at: datetime

class PublicPaymentOut(BaseModel):
    amount: float
    currency: str
    status: PaymentStatus
    payment_link_token: Optional[str] = None  # only while the parent still needs to pay
    link_expires_at: datetime
    paid_at: Optional[datetime] = None

class PublicPublicationOut(BaseModel):
    publication_status: PublicationStatus
    publication_url: Optional[str] = None
    publication_notes: Optional[str] = None
    published_at: Optional[datetime] = None

class PublicCommunicationOut(BaseModel):
    id: int
    template: str
    subject: str
    status: CommStatus
    sent_at: Optional[datetime] = None
    created_at: datetime

class PublicLeadDetailOut(BaseModel):
    lead: PublicLeadOut
    writathon: WritathonOut
    submission: Optional[PublicSubmissionOut] = None
    plagiarism_review: Optional[PublicPlagiarismOut] = None
    story_review: Optional[PublicReviewOut] = None
    payment: Optional[PublicPaymentOut] = None
    publication: Optional[PublicPublicationOut] = None
    communications: List[PublicCommunicationOut] = []

class StudentOut(BaseModel):
    id: int
    parent_name: str
    parent_email: str
    parent_phone: str
    child_name: str
    child_dob: Optional[date] = None
    school: str
    grade: str
    country: str
    created_at: datetime
    registration_count: int = 0

    class Config:
        from_attributes = True

class StudentHistoryOut(BaseModel):
    student: StudentOut
    registrations: List[LeadOut]

class SubmissionListItem(StorySubmissionOut):
    lead_code: str
    child_name: str
    writathon_id: int
    writathon_name: str

class WritathonReport(BaseModel):
    writathon_id: int
    writathon_name: str
    status: WritathonStatus
    registrations: int
    submissions: int
    not_submitted: int

class OwnerCount(BaseModel):
    owner_id: Optional[int] = None
    owner_name: str
    leads: int

class DashboardStats(BaseModel):
    total_leads: int
    new_leads: int
    contacted: int
    reminder_sent: int
    stories_submitted: int
    under_review: int
    eligible: int
    not_eligible: int
    payment_pending: int
    paid: int
    completed: int
    published: int
    revenue_total: float
    currency: str = "INR"
    total_students: int = 0
    unassigned_leads: int = 0
    by_writathon: List[WritathonReport] = []
    # Metric definitions are in DATABASE_REVIEW.md / the dashboard API docstring
    total_writathons: int = 0
    total_submissions: int = 0
    registered_not_submitted: int = 0
    awaiting_review: int = 0
    eligible_decisions: int = 0
    not_eligible_decisions: int = 0
    conversion_rate: float = 0.0
    owner_distribution: List[OwnerCount] = []

class StaffDashboardStats(BaseModel):
    assigned_leads: int = 0
    contacted: int = 0
    reminder_sent: int = 0
    stories_submitted: int = 0
    under_review: int = 0
    eligible: int = 0
    not_eligible: int = 0
    payment_pending: int = 0
    paid: int = 0
    completed: int = 0
    published: int = 0
    awaiting_review: int = 0
    pending_tasks: int = 0
