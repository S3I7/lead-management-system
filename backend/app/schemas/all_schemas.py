from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field
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
    pass

class WritathonUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    submission_deadline: Optional[datetime] = None
    guidelines: Optional[str] = None
    submission_fee: Optional[float] = None
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
    child_age: int = Field(..., ge=4, le=18)
    grade: str = Field(..., min_length=1, max_length=50)
    school: str = Field(..., min_length=2, max_length=255)
    parent_name: str = Field(..., min_length=2, max_length=255)
    parent_email: EmailStr
    parent_phone: str = Field(..., min_length=7, max_length=25)
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
    child_age: int
    school: str
    grade: str
    country: str
    status: LeadStatus
    source: str
    access_token: str
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
    plagiarism_notes: Optional[str] = None
    reference_sources: Optional[str] = None

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
    feedback: Optional[str] = None  # Mandatory if NOT_ELIGIBLE
    internal_notes: Optional[str] = None

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

# --- Publication Schemas ---
class PublicationUpdate(BaseModel):
    publication_status: PublicationStatus
    publication_url: Optional[str] = None
    publication_notes: Optional[str] = None

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

# --- Dashboard Stats Schema ---
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
