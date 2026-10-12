import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, downloadStory, LeadDetail, PlagiarismStatus, ReviewDecision, PublicationStatus } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { LeadJourneyStepper } from '../../components/LeadJourneyStepper';
import { 
  ArrowLeft, Download, ShieldCheck, UserCheck, CreditCard, 
  BookOpen, Mail, RefreshCw, Send, CheckCircle2, AlertCircle, 
  ExternalLink, Sparkles, Eye, FileText 
} from 'lucide-react';

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Plagiarism review form state
  const [plagStatus, setPlagStatus] = useState<'NOT_CHECKED' | 'PASS' | 'FLAGGED'>('PASS');
  const [plagNotes, setPlagNotes] = useState('');
  const [plagSources, setPlagSources] = useState('Manual Google Search & Archive reference check');
  const [isSavingPlag, setIsSavingPlag] = useState(false);

  // Staff review form state
  const [reviewDecision, setReviewDecision] = useState<'ELIGIBLE' | 'NOT_ELIGIBLE'>('ELIGIBLE');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSavingReview, setIsSavingReview] = useState(false);

  // Publication form state
  const [pubStatus, setPubStatus] = useState<'NOT_READY' | 'READY' | 'PUBLISHED'>('PUBLISHED');
  const [pubUrl, setPubUrl] = useState('');
  const [pubNotes, setPubNotes] = useState('');
  const [isSavingPub, setIsSavingPub] = useState(false);

  // Email preview modal state
  const [previewEmail, setPreviewEmail] = useState<{ subject: string; body_content: string } | null>(null);

  const fetchLead = async () => {
    if (!id) return;
    setIsLoading(true);
    setActionMessage('');
    setActionError('');
    try {
      const res = await api.get<LeadDetail>(`/leads/${id}`);
      setLeadDetail(res.data);
      if (res.data.plagiarism_review) {
        setPlagStatus(res.data.plagiarism_review.status);
        setPlagNotes(res.data.plagiarism_review.plagiarism_notes || '');
        setPlagSources(res.data.plagiarism_review.reference_sources || '');
      }
      if (res.data.story_review) {
        setReviewDecision(res.data.story_review.decision);
        setReviewFeedback(res.data.story_review.feedback || '');
        setReviewNotes(res.data.story_review.internal_notes || '');
      }
      if (res.data.publication) {
        setPubStatus(res.data.publication.publication_status);
        setPubUrl(res.data.publication.publication_url || '');
        setPubNotes(res.data.publication.publication_notes || '');
      }
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to fetch lead details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  // Handler 1: Save Manual Plagiarism Check (STRICTLY NO AI)
  const handleSavePlagiarism = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadDetail?.submission) return;
    setIsSavingPlag(true);
    setActionMessage('');
    setActionError('');
    try {
      await api.post(`/plagiarism/${leadDetail.submission.id}`, {
        status: plagStatus,
        plagiarism_notes: plagNotes,
        reference_sources: plagSources,
      });
      setActionMessage('Manual originality review recorded successfully.');
      await fetchLead();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to save plagiarism review.');
    } finally {
      setIsSavingPlag(false);
    }
  };

  // Handler 2: Staff Editorial Review Decision
  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadDetail?.submission) return;
    if (reviewDecision === 'NOT_ELIGIBLE' && !reviewFeedback.trim()) {
      setActionError('Feedback reason is mandatory when marking as NOT ELIGIBLE.');
      return;
    }
    setIsSavingReview(true);
    setActionMessage('');
    setActionError('');
    try {
      await api.post(`/reviews/${leadDetail.submission.id}`, {
        decision: reviewDecision,
        feedback: reviewFeedback,
        internal_notes: reviewNotes,
      });
      setActionMessage(
        reviewDecision === 'ELIGIBLE'
          ? 'Story marked ELIGIBLE! Payment link generated and email sent to parent.'
          : 'Story marked NOT ELIGIBLE. Feedback email sent to parent.'
      );
      await fetchLead();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to submit review decision.');
    } finally {
      setIsSavingReview(false);
    }
  };

  // Handler 3: Update Publication
  const handleSavePublication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadDetail?.submission) return;
    setIsSavingPub(true);
    setActionMessage('');
    setActionError('');
    try {
      await api.put(`/publications/${leadDetail.submission.id}`, {
        publication_status: pubStatus,
        publication_url: pubUrl,
        publication_notes: pubNotes,
      });
      setActionMessage('Publication status updated successfully.');
      await fetchLead();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to update publication.');
    } finally {
      setIsSavingPub(false);
    }
  };

  // Handler 4: Resend Email
  const handleResendEmail = async (commId: number) => {
    try {
      await api.post(`/emails/communications/resend/${commId}`);
      setActionMessage('Email re-dispatched and logged.');
      await fetchLead();
    } catch (err: any) {
      setActionError('Failed to resend communication.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-text-muted">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (!leadDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg px-4">
        <div className="bg-white rounded-card p-8 text-center max-w-md w-full border border-app-border">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <h2 className="text-xl font-heading font-bold text-text-dark">Lead Not Found</h2>
          <Link to="/admin/leads" className="btn-secondary text-xs mt-4">
            Return to Leads Directory
          </Link>
        </div>
      </div>
    );
  }

  const { lead, writathon, submission, plagiarism_review, story_review, payment, publication, communications } = leadDetail;

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      {/* Top Breadcrumb & Actions Bar */}
      <section className="bg-white border-b border-app-border py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/admin/leads" className="p-2 rounded-full hover:bg-gray-100 transition text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-heading font-extrabold text-text-dark">
                  {lead.child_name}
                </h1>
                <StatusBadge status={lead.status} />
              </div>
              <p className="text-xs text-text-muted">
                Lead ID: <strong className="text-primary">{lead.lead_id}</strong> • Campaign: {writathon.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLead}
              className="btn-ghost text-xs py-1.5 px-3 border border-app-border"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <Link
              to={`/status/${lead.lead_id}`}
              target="_blank"
              className="btn-secondary text-xs py-1.5 px-3.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Parent Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Banner Alert for Action results */}
        {actionMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage('')} className="text-gray-400 hover:text-black">✕</button>
          </div>
        )}
        {actionError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <span>{actionError}</span>
            <button onClick={() => setActionError('')} className="text-gray-400 hover:text-black">✕</button>
          </div>
        )}

        {/* Visual Stepper */}
        <LeadJourneyStepper
          currentStatus={lead.status}
          hasSubmission={!!submission}
          plagiarismChecked={plagiarism_review?.status !== 'NOT_CHECKED'}
          isEligible={lead.status === 'ELIGIBLE' || story_review?.decision === 'ELIGIBLE'}
          isPaid={payment?.status === 'PAID'}
          isPublished={publication?.publication_status === 'PUBLISHED'}
        />

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (1 col): Lead Info & Payment */}
          <div className="space-y-6">
            {/* Section A: Lead Information */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
              <h2 className="text-base font-heading font-bold text-text-dark border-b border-gray-100 pb-3 mb-4">
                Lead Profile Information
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-gray-400">Child Author:</span>
                  <p className="font-bold text-text-dark text-sm mt-0.5">{lead.child_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-400">Age:</span>
                    <p className="font-semibold text-text-dark">{lead.age_group ?? lead.child_age} years{lead.submission_category && ` · ${lead.submission_category}`}{lead.city && ` · ${lead.city}`}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Grade:</span>
                    <p className="font-semibold text-text-dark">{lead.grade}</p>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400">School:</span>
                  <p className="font-semibold text-text-dark">{lead.school}</p>
                </div>

                <div>
                  <span className="text-gray-400">Parent / Guardian:</span>
                  <p className="font-semibold text-text-dark">{lead.parent_name}</p>
                </div>

                <div>
                  <span className="text-gray-400">Parent Email:</span>
                  <p className="font-semibold text-text-dark">{lead.parent_email}</p>
                </div>

                <div>
                  <span className="text-gray-400">Parent Phone:</span>
                  <p className="font-semibold text-text-dark">{lead.parent_phone}</p>
                </div>

                <div>
                  <span className="text-gray-400">Country:</span>
                  <p className="font-semibold text-text-dark">{lead.country}</p>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <span className="text-gray-400">Registration Date:</span>
                  <p className="font-semibold text-text-dark">{new Date(lead.created_at).toLocaleString()}</p>
                </div>

                <div>
                  <span className="text-gray-400">Reminders Sent:</span>
                  <p className="font-semibold text-text-dark">{lead.reminder_count} sent</p>
                </div>
              </div>
            </div>

            {/* Section E: Payment Information */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h2 className="text-base font-heading font-bold text-text-dark flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Payment Status
                </h2>
                {payment && <StatusBadge status={payment.status} />}
              </div>

              {payment ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-gray-400">Amount & Currency:</span>
                    <p className="font-bold text-base text-primary mt-0.5">
                      {payment.amount} {payment.currency}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Gateway Reference:</span>
                    <p className="font-semibold text-text-dark font-mono text-[11px] truncate">
                      {payment.gateway_payment_id || 'N/A'}
                    </p>
                  </div>
                  {payment.paid_at && (
                    <div>
                      <span className="text-gray-400">Paid At:</span>
                      <p className="font-semibold text-teal-800">
                        {new Date(payment.paid_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Direct Payment Link:</span>
                    <a
                      href={payment.payment_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline block truncate mt-0.5 font-mono text-[11px]"
                    >
                      {payment.payment_link}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-xl text-xs text-text-muted">
                  No payment generated yet. Payment becomes available once story is marked ELIGIBLE.
                </div>
              )}
            </div>

            {/* Section F: Publication Workflow */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h2 className="text-base font-heading font-bold text-text-dark flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-secondary" />
                  Publication Management
                </h2>
                {publication && <StatusBadge status={publication.publication_status} />}
              </div>

              {submission ? (
                <form onSubmit={handleSavePublication} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-gray-500 font-semibold mb-1">
                      Publication Status
                    </label>
                    <select
                      value={pubStatus}
                      onChange={(e) => setPubStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border outline-none font-semibold"
                    >
                      <option value="NOT_READY">NOT_READY</option>
                      <option value="READY">READY (Typesetting in progress)</option>
                      <option value="PUBLISHED">PUBLISHED (Live in Anthology)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-500 font-semibold mb-1">
                      Live Anthology URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://writathon.org/publications/story-slug"
                      value={pubUrl}
                      onChange={(e) => setPubUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 font-semibold mb-1">
                      Publication Notes / ISBN
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Volume 1, ISBN 978-3-16-148410-0"
                      value={pubNotes}
                      onChange={(e) => setPubNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingPub}
                    className="btn-primary w-full text-xs py-2"
                  >
                    {isSavingPub ? 'Updating...' : 'Update Publication Status'}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-text-muted text-center py-4 bg-gray-50 rounded-xl">
                  Awaiting story submission.
                </p>
              )}
            </div>
          </div>

          {/* Right Column (2 cols): Story, Plagiarism, Review Decision & Emails */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section B: Story Submission Details */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h2 className="text-base font-heading font-bold text-text-dark flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Submitted Story Document
                </h2>
                {submission && <StatusBadge status={submission.status} />}
              </div>

              {submission ? (
                <div className="space-y-4">
                  <div className="p-4 bg-primary-soft/40 rounded-2xl border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-heading font-bold text-text-dark">
                        "{submission.title}"
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Category: <strong>{submission.category || 'General Fiction'}</strong> • Word Count: <strong>{submission.word_count || 'N/A'}</strong> • Submitted: {new Date(submission.submitted_at).toLocaleString()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => downloadStory(submission).catch(() => setActionError('Could not download the story file.'))}
                      className="btn-secondary text-xs py-2 px-4 shadow-xs shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      Download {submission.file_name}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center bg-gray-50 rounded-2xl border border-gray-200 text-xs text-text-muted">
                  No story document uploaded yet by the parent. Lead is receiving scheduled reminders.
                </div>
              )}
            </div>

            {/* Section C: Manual Plagiarism Review (STRICT REQUIREMENT: NO AI) */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
                <div>
                  <h2 className="text-base font-heading font-bold text-text-dark flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo" />
                    Manual Plagiarism Assessment
                  </h2>
                  <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                    Strict Requirement: Human Reviewer Only (No AI Detector)
                  </span>
                </div>
                {plagiarism_review && <StatusBadge status={plagiarism_review.status} />}
              </div>

              {submission ? (
                <form onSubmit={handleSavePlagiarism} className="space-y-4 text-xs mt-4">
                  <div>
                    <label className="block text-xs font-bold text-text-dark mb-1.5">
                      Reviewer Assessment Result *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlagStatus('PASS')}
                        className={`py-2 px-3 rounded-xl border text-center font-bold transition ${
                          plagStatus === 'PASS'
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : 'bg-white border-app-border hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        ✓ PASS (Original)
                      </button>

                      <button
                        type="button"
                        onClick={() => setPlagStatus('FLAGGED')}
                        className={`py-2 px-3 rounded-xl border text-center font-bold transition ${
                          plagStatus === 'FLAGGED'
                            ? 'bg-rose-500 text-white border-rose-600'
                            : 'bg-white border-app-border hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        ✕ FLAGGED
                      </button>

                      <button
                        type="button"
                        onClick={() => setPlagStatus('NOT_CHECKED')}
                        className={`py-2 px-3 rounded-xl border text-center font-bold transition ${
                          plagStatus === 'NOT_CHECKED'
                            ? 'bg-gray-600 text-white border-gray-700'
                            : 'bg-white border-app-border hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        NOT CHECKED
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      Reviewer Plagiarism Notes & Observations
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Manually checked against online story archives. Vocabulary and syntax match child's grade level."
                      value={plagNotes}
                      onChange={(e) => setPlagNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      Reference / Source Information
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Google Search check, Turnitin archive check, School anthology match"
                      value={plagSources}
                      onChange={(e) => setPlagSources(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border outline-none"
                    />
                  </div>

                  {plagiarism_review?.checked_at && (
                    <p className="text-[11px] text-text-muted">
                      Last checked by: <strong>{plagiarism_review.reviewer_name || 'Staff'}</strong> on {new Date(plagiarism_review.checked_at).toLocaleString()}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingPlag}
                    className="btn-secondary text-xs py-2 px-5"
                  >
                    {isSavingPlag ? 'Recording...' : 'Record Plagiarism Assessment'}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-text-muted text-center py-6 bg-gray-50 rounded-xl mt-3">
                  Upload a story submission first to perform manual originality review.
                </p>
              )}
            </div>

            {/* Section D: Staff Editorial Review Decision */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
                <h2 className="text-base font-heading font-bold text-text-dark flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-secondary" />
                  Staff Editorial Review Decision
                </h2>
                {story_review && <StatusBadge status={story_review.decision} />}
              </div>

              {submission ? (
                <form onSubmit={handleSaveReview} className="space-y-4 text-xs mt-4">
                  <div>
                    <label className="block text-xs font-bold text-text-dark mb-1.5">
                      Eligibility Decision *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReviewDecision('ELIGIBLE')}
                        className={`py-2.5 px-4 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 ${
                          reviewDecision === 'ELIGIBLE'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-white border-app-border hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        ELIGIBLE (Proceed to Payment)
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewDecision('NOT_ELIGIBLE')}
                        className={`py-2.5 px-4 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 ${
                          reviewDecision === 'NOT_ELIGIBLE'
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                            : 'bg-white border-app-border hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        ✕ NOT ELIGIBLE
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      Editorial Feedback (Sent to Parent) {reviewDecision === 'NOT_ELIGIBLE' && '* Mandatory'}
                    </label>
                    <textarea
                      rows={3}
                      placeholder={
                        reviewDecision === 'ELIGIBLE'
                          ? 'e.g. Outstanding story with vibrant character dynamics and creative twists!'
                          : 'Please explain constructively why this story was not selected.'
                      }
                      value={reviewFeedback}
                      onChange={(e) => setReviewFeedback(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border outline-none focus:ring-2 focus:ring-primary"
                      required={reviewDecision === 'NOT_ELIGIBLE'}
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      Internal Editorial Notes (Staff only)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Recommended for cover feature or anthology volume 1"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {story_review?.reviewed_at && (
                      <span className="text-[11px] text-text-muted">
                        Reviewed on {new Date(story_review.reviewed_at).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingReview}
                      className="btn-primary text-xs py-2 px-6 ml-auto"
                    >
                      {isSavingReview ? 'Submitting...' : 'Submit Decision & Notify Parent'}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-text-muted text-center py-6 bg-gray-50 rounded-xl mt-3">
                  Awaiting story submission.
                </p>
              )}
            </div>

            {/* Section G: Email Communication Audit History */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
              <h2 className="text-base font-heading font-bold text-text-dark flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                <Mail className="w-5 h-5 text-indigo" />
                Email Communication History Log ({communications.length})
              </h2>

              {communications.length === 0 ? (
                <p className="text-xs text-text-muted">No emails dispatched yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {communications.map((comm) => (
                    <div key={comm.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-dark">{comm.subject}</span>
                          <StatusBadge status={comm.status} />
                        </div>
                        <p className="text-text-muted mt-0.5">
                          Template: <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] text-primary">{comm.template}</code> • Recipient: {comm.recipient}
                        </p>
                        <span className="text-[10px] text-gray-400">
                          {new Date(comm.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setPreviewEmail({ subject: comm.subject, body_content: comm.body_content })}
                          className="btn-ghost text-[11px] py-1 px-2.5 border border-app-border"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Body
                        </button>
                        <button
                          onClick={() => handleResendEmail(comm.id)}
                          className="btn-secondary text-[11px] py-1 px-2.5"
                        >
                          <Send className="w-3 h-3" />
                          Resend
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {previewEmail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-card max-w-2xl w-full p-6 shadow-elevated border border-app-border max-h-[90vh] flex flex-col animate-fadeIn">
            <div className="flex items-center justify-between border-b border-app-border pb-3 mb-4">
              <div>
                <span className="text-xs uppercase font-bold text-text-muted">Dispatched Email Preview</span>
                <h3 className="text-base font-heading font-bold text-text-dark mt-0.5">
                  {previewEmail.subject}
                </h3>
              </div>
              <button
                onClick={() => setPreviewEmail(null)}
                className="text-gray-400 hover:text-black font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div
              className="overflow-y-auto flex-1 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs"
              dangerouslySetInnerHTML={{ __html: previewEmail.body_content }}
            />

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setPreviewEmail(null)}
                className="btn-primary text-xs py-1.5 px-4"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
