import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('writathon_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'STAFF' | 'PARENT';
  is_active: boolean;
  created_at: string;
}

export interface Writathon {
  id: number;
  name: string;
  code: string;
  description?: string;
  start_date: string;
  end_date: string;
  submission_deadline: string;
  guidelines?: string;
  submission_fee: number;
  currency: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUBMISSIONS_CLOSED' | 'COMPLETED';
}

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'REMINDER_SENT'
  | 'STORY_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'COMPLETED';

export interface Lead {
  id: number;
  lead_id: string;
  writathon_id: number;
  writathon_name?: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  child_name: string;
  child_dob?: string;
  child_age: number;
  school: string;
  grade: string;
  country: string;
  status: LeadStatus;
  source: string;
  access_token: string;
  reminder_count: number;
  last_reminder_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StorySubmission {
  id: number;
  lead_id: number;
  title: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  word_count?: number;
  category?: string;
  originality_declaration: boolean;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'APPROVED' | 'PUBLISHED';
  submitted_at: string;
  created_at: string;
}

export type PlagiarismStatus = 'NOT_CHECKED' | 'PASS' | 'FLAGGED';
export type ReviewDecision = 'ELIGIBLE' | 'NOT_ELIGIBLE';
export type PublicationStatus = 'NOT_READY' | 'READY' | 'PUBLISHED';

export interface ManualPlagiarismReview {
  id: number;
  story_id: number;
  reviewer_id?: number;
  reviewer_name?: string;
  status: PlagiarismStatus;
  plagiarism_notes?: string;
  reference_sources?: string;
  checked_at?: string;
  created_at: string;
}

export interface StoryReview {
  id: number;
  story_id: number;
  reviewer_id: number;
  reviewer_name?: string;
  decision: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  feedback?: string;
  internal_notes?: string;
  reviewed_at: string;
  created_at: string;
}

export interface Payment {
  id: number;
  lead_id: number;
  story_id: number;
  gateway: string;
  gateway_payment_id?: string;
  amount: number;
  currency: string;
  status: 'LINK_SENT' | 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  payment_link: string;
  payment_link_token: string;
  link_expires_at: string;
  paid_at?: string;
  created_at: string;
}

export interface Publication {
  id: number;
  story_id: number;
  publisher_id?: number;
  publisher_name?: string;
  publication_status: 'NOT_READY' | 'READY' | 'PUBLISHED';
  publication_url?: string;
  publication_notes?: string;
  published_at?: string;
  created_at: string;
}

export interface CommunicationLog {
  id: number;
  lead_id: number;
  type: string;
  template: string;
  recipient: string;
  subject: string;
  body_content: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

export interface LeadDetail {
  lead: Lead;
  writathon: Writathon;
  submission?: StorySubmission;
  plagiarism_review?: ManualPlagiarismReview;
  story_review?: StoryReview;
  payment?: Payment;
  publication?: Publication;
  communications: CommunicationLog[];
}

export interface DashboardStats {
  total_leads: number;
  new_leads: number;
  contacted: number;
  reminder_sent: number;
  stories_submitted: number;
  under_review: number;
  eligible: number;
  not_eligible: number;
  payment_pending: number;
  paid: number;
  completed: number;
  published: number;
  revenue_total: number;
  currency: string;
}

export interface EmailTemplate {
  id: number;
  template_code: string;
  name: string;
  subject_template: string;
  body_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
