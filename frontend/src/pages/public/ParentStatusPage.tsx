import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, PublicLeadDetail } from '../../api/client';
import { LeadJourneyStepper } from '../../components/LeadJourneyStepper';
import { StatusBadge } from '../../components/StatusBadge';
import { 
  Search, BookOpen, CreditCard, Sparkles, 
  Mail, Calendar, School, Award, AlertCircle, CheckCircle2, 
  ExternalLink, Copy, Check, ArrowRight, User, FileText,
  Clock, ShieldCheck, ChevronRight
} from 'lucide-react';

export const ParentStatusPage: React.FC = () => {
  const { leadId: paramLeadId } = useParams<{ leadId?: string }>();
  const navigate = useNavigate();

  const [searchCode, setSearchCode] = useState(paramLeadId || '');
  const [leadDetail, setLeadDetail] = useState<PublicLeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (paramLeadId) fetchStatus(paramLeadId);
  }, [paramLeadId]);

  const fetchStatus = async (code: string) => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const cleanCode = code.trim();
      const endpoint = cleanCode.toUpperCase().startsWith('WR-')
        ? `/leads/by-code/${cleanCode}`
        : `/leads/by-token/${cleanCode}`;
      const res = await api.get<PublicLeadDetail>(endpoint);
      setLeadDetail(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No registration record found for this Tracking ID. Please double-check the code from your confirmation email.');
      setLeadDetail(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(searchCode);
  };

  const handleCopyLeadId = () => {
    if (leadDetail?.lead.lead_id) {
      navigator.clipboard.writeText(leadDetail.lead.lead_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper for friendly email template names
  const getFriendlyTemplateName = (code: string) => {
    const map: Record<string, string> = {
      INTEREST_CONFIRMATION: 'Registration Welcome & Guidelines',
      SUBMISSION_CONFIRMATION: 'Story Submission Received Confirmation',
      SUBMISSION_REMINDER: 'Friendly Story Submission Reminder',
      REVIEW_RESULT_ELIGIBLE: 'Editorial Approval & Publication Invitation',
      REVIEW_RESULT_NOT_ELIGIBLE: 'Editorial Review Feedback & Guidance',
      PAYMENT_LINK: 'Publication Fee Invoice & Checkout Link',
      PAYMENT_CONFIRMATION: 'Payment Received & Publication Scheduled',
      FINAL_CONFIRMATION: 'Anthology Book Release Confirmation',
    };
    return map[code] || code.replace(/_/g, ' ');
  };

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      {/* Search & Hero Header */}
      <section className="relative overflow-hidden pt-12 pb-14 bg-gradient-to-b from-purple-50/70 via-pink-50/40 to-app-bg border-b border-app-border">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-soft text-primary px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase mb-3 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-secondary" />
            Writathon Participant Portal
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-text-dark tracking-tight">
            Track Young Author Journey
          </h1>
          <p className="mt-2 text-sm text-text-muted max-w-xl mx-auto leading-relaxed">
            Check live editorial review milestones, originality assessment, feedback, and anthology publication progress.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter Lead ID (e.g. WR-2026-ANWW9HNN)"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-300 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm uppercase font-mono tracking-wider bg-white shadow-xs transition"
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading || !searchCode.trim()}
              className="btn-primary py-3 px-7 text-sm font-bold shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Track Status</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-16 bg-white rounded-3xl border border-app-border shadow-xs">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <h3 className="font-heading font-bold text-text-dark">Fetching Journey Details</h3>
            <p className="text-xs text-text-muted mt-1">Retrieving author records and review queues...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 max-w-xl mx-auto text-center shadow-xs">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <h3 className="font-heading font-bold text-base mb-1">Registration Record Not Found</h3>
            <p className="text-xs text-rose-700 leading-relaxed mb-4">{error}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link to="/register" className="btn-primary text-xs py-2 px-4">
                Register as New Participant
              </Link>
              <button 
                type="button" 
                onClick={() => setSearchCode('')} 
                className="px-4 py-2 rounded-full border border-rose-300 bg-white text-xs font-semibold text-rose-800 hover:bg-rose-100/50"
              >
                Clear Search
              </button>
            </div>
          </div>
        )}

        {/* Empty Search Prompt (when no search executed yet) */}
        {!leadDetail && !isLoading && !error && (
          <div className="bg-white rounded-3xl p-8 md:p-12 text-center border border-app-border shadow-xs max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-primary-soft text-primary flex items-center justify-center mx-auto mb-4 shadow-sm">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-xl md:text-2xl font-heading font-extrabold text-text-dark">
              Enter Your Child's Tracking ID Above
            </h2>
            <p className="text-xs md:text-sm text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
              Your unique Tracking ID was generated upon registration and sent to your email. You can also submit your story directly from this page once located.
            </p>
            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-center justify-center gap-3 text-xs text-text-muted">
              <span>Need to register first?</span>
              <Link to="/register" className="text-primary font-bold hover:underline inline-flex items-center gap-1">
                Open Registration Form <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Journey Details View */}
        {leadDetail && !isLoading && (
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Author Profile Hero Card (Clean, modern redesign) */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-app-border relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-100/40 via-pink-100/20 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                {/* Author Info */}
                <div className="flex items-start gap-4">
                  {/* Author Avatar Initial */}
                  <div className="w-16 h-16 rounded-2xl bg-brand-gradient text-white flex items-center justify-center font-heading font-extrabold text-2xl shadow-md shadow-purple-500/25 shrink-0">
                    {leadDetail.lead.child_name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                      <h2 className="text-2xl md:text-3xl font-heading font-black text-text-dark tracking-tight">
                        {leadDetail.lead.child_name}
                      </h2>
                      <StatusBadge status={leadDetail.lead.status} />
                    </div>

                    {/* Metadata Chips Grid */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-main mt-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                        <School className="w-3.5 h-3.5 text-gray-500" />
                        {leadDetail.lead.grade} • {leadDetail.lead.school}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        Age {leadDetail.lead.age_group || leadDetail.lead.child_age} yrs
                      </span>
                      {leadDetail.lead.submission_category && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                          {leadDetail.lead.submission_category}
                        </span>
                      )}
                    </div>

                    {/* Secondary Details: Campaign & Parent */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-3 pt-3 border-t border-gray-100">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-secondary" />
                        Campaign: <strong className="text-text-dark ml-1">{leadDetail.writathon.name}</strong>
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        Parent: <span className="text-text-dark ml-1">{leadDetail.lead.parent_name}</span> ({leadDetail.lead.parent_email})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Tracking ID Card & Primary Action */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0 bg-gray-50/80 p-4 rounded-2xl border border-gray-200/80">
                  <div>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                      Registration Tracking ID
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm md:text-base font-mono font-extrabold text-primary bg-white px-3 py-1 rounded-xl border border-primary/20 shadow-xs">
                        {leadDetail.lead.lead_id}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyLeadId}
                        title="Copy Lead ID"
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-white text-gray-500 hover:text-primary transition shadow-xs"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Contextual Action Button */}
                  {!leadDetail.submission && (
                    <button
                      onClick={() => navigate(`/submit-story/${leadDetail.lead.lead_id}`)}
                      className="btn-primary text-xs py-2.5 px-5 w-full sm:w-auto shadow-md"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Submit Story Document</span>
                    </button>
                  )}

                  {leadDetail.payment && leadDetail.payment.status !== 'PAID' && leadDetail.lead.status === 'PAYMENT_PENDING' && (
                    <button
                      onClick={() => navigate(`/payment/${leadDetail.payment?.payment_link_token}`)}
                      className="btn-primary text-xs py-2.5 px-5 w-full sm:w-auto shadow-md"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pay Publication Fee ({leadDetail.payment.amount} {leadDetail.payment.currency})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Visual 5-Stage Milestone Stepper */}
            <LeadJourneyStepper
              currentStatus={leadDetail.lead.status}
              hasSubmission={!!leadDetail.submission}
              plagiarismChecked={leadDetail.plagiarism_review?.status !== 'NOT_CHECKED'}
              isEligible={leadDetail.lead.status === 'ELIGIBLE' || leadDetail.story_review?.decision === 'ELIGIBLE'}
              isPaid={leadDetail.payment?.status === 'PAID'}
              isPublished={leadDetail.publication?.publication_status === 'PUBLISHED'}
              onActionClick={() => {
                if (!leadDetail.submission) {
                  navigate(`/submit-story/${leadDetail.lead.lead_id}`);
                } else if (leadDetail.payment?.payment_link_token && leadDetail.payment.status !== 'PAID') {
                  navigate(`/payment/${leadDetail.payment.payment_link_token}`);
                }
              }}
            />

            {/* 3. Grid of Story & Status Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Submitted Story Card */}
              <div className="bg-white rounded-3xl p-6 md:p-7 shadow-sm border border-app-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                    <h3 className="font-heading font-bold text-base text-text-dark flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Story Document Details
                    </h3>
                    {leadDetail.submission && <StatusBadge status={leadDetail.submission.status} />}
                  </div>

                  {leadDetail.submission ? (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                          Story Title
                        </span>
                        <p className="font-heading font-extrabold text-lg text-text-dark mt-0.5">
                          "{leadDetail.submission.title}"
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                        <div>
                          <span className="text-text-muted text-[11px] block">Genre / Category</span>
                          <span className="font-bold text-text-dark mt-0.5 block">
                            {leadDetail.submission.category || 'Creative Story'}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted text-[11px] block">Word Count</span>
                          <span className="font-bold text-text-dark mt-0.5 block">
                            {leadDetail.submission.word_count ? `${leadDetail.submission.word_count} words` : 'Not specified'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                        <span className="truncate max-w-[200px]">
                          File: <strong>{leadDetail.submission.file_name}</strong>
                        </span>
                        <span className="text-[11px] bg-purple-50 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                          Submitted on {new Date(leadDetail.submission.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 px-4 bg-gray-50/70 rounded-2xl border-2 border-dashed border-gray-200">
                      <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center mx-auto mb-2">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <h4 className="font-heading font-bold text-sm text-text-dark">No Story Uploaded Yet</h4>
                      <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                        Attach your child's creative work (.DOCX or .PDF format) to begin human editorial review.
                      </p>
                      <button
                        onClick={() => navigate(`/submit-story/${leadDetail.lead.lead_id}`)}
                        className="btn-primary text-xs py-2 px-5 mt-4 shadow-sm"
                      >
                        Upload Story File
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Editorial Review & Outcome Card */}
              <div className="bg-white rounded-3xl p-6 md:p-7 shadow-sm border border-app-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                    <h3 className="font-heading font-bold text-base text-text-dark flex items-center gap-2">
                      <Award className="w-5 h-5 text-secondary" />
                      Editorial Assessment Result
                    </h3>
                    {leadDetail.story_review && <StatusBadge status={leadDetail.story_review.decision} />}
                  </div>

                  {leadDetail.story_review ? (
                    <div className="space-y-4">
                      {/* Editorial Decision Banner */}
                      <div className={`p-4 rounded-2xl border ${
                        leadDetail.story_review.decision === 'ELIGIBLE'
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : 'bg-rose-50/80 border-rose-200 text-rose-950'
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          {leadDetail.story_review.decision === 'ELIGIBLE' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                          )}
                          <p className="font-bold text-xs uppercase tracking-wider">
                            {leadDetail.story_review.decision === 'ELIGIBLE'
                              ? 'Approved for Publication'
                              : 'Editorial Review Completed'}
                          </p>
                        </div>
                        {leadDetail.story_review.feedback && (
                          <p className="text-xs italic leading-relaxed bg-white/70 p-3 rounded-xl border border-current/10">
                            "{leadDetail.story_review.feedback}"
                          </p>
                        )}
                      </div>

                      {/* Payment Action if Eligible & Pending */}
                      {leadDetail.lead.status === 'PAYMENT_PENDING' && leadDetail.payment && (
                        <div className="p-4 bg-primary-soft/70 rounded-2xl border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                              Publication Fee Due
                            </span>
                            <p className="text-base font-extrabold text-text-dark">
                              {leadDetail.payment.amount} {leadDetail.payment.currency}
                            </p>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              Locks in ISBN assignment, book formatting, and printing.
                            </p>
                          </div>
                          <button
                            onClick={() => navigate(`/payment/${leadDetail.payment?.payment_link_token}`)}
                            className="btn-primary text-xs py-2 px-4 shadow-sm shrink-0"
                          >
                            Pay Publication Fee
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 px-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                      <div className="w-12 h-12 rounded-full bg-secondary-soft text-secondary flex items-center justify-center mx-auto mb-2">
                        <Clock className="w-6 h-6" />
                      </div>
                      <h4 className="font-heading font-bold text-sm text-text-dark">
                        {leadDetail.submission ? 'Editorial Review in Progress' : 'Awaiting Story Submission'}
                      </h4>
                      <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                        {leadDetail.submission
                          ? 'Our dedicated human reviewers are assessing the story for creativity, character voice, and originality.'
                          : 'Once the story document is uploaded, our editorial team will begin the review process.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Publication Live Announcement (if Published) */}
            {leadDetail.publication && leadDetail.publication.publication_status !== 'NOT_READY' && (
              <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
                  <div>
                    <div className="inline-flex items-center gap-1.5 bg-white/20 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-gold" />
                      {leadDetail.publication.publication_status === 'PUBLISHED' ? 'Official Anthology Live' : 'Ready for Publication'}
                    </div>
                    <h3 className="text-xl md:text-2xl font-heading font-extrabold tracking-tight">
                      "{leadDetail.submission?.title}" by {leadDetail.lead.child_name}
                    </h3>
                    <p className="text-xs text-white/90 mt-1 max-w-xl leading-relaxed">
                      {leadDetail.publication.publication_notes || 'All typesetting, book cover artwork, and ISBN assignment are complete.'}
                    </p>
                  </div>
                  {leadDetail.publication.publication_url && (
                    <a
                      href={leadDetail.publication.publication_url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white text-primary font-bold px-6 py-3 rounded-full text-xs inline-flex items-center gap-2 hover:bg-gray-100 transition shadow-md shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View Published Book</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* 5. Communications Activity Feed */}
            <div className="bg-white rounded-3xl p-6 md:p-7 shadow-sm border border-app-border">
              <h3 className="font-heading font-bold text-base text-text-dark flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <Mail className="w-5 h-5 text-indigo" />
                Notification & Communication History
              </h3>

              {leadDetail.communications.length === 0 ? (
                <p className="text-xs text-text-muted">No emails dispatched yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {leadDetail.communications.map((comm) => (
                    <div key={comm.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 mt-0.5">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-text-dark">{comm.subject}</span>
                            <StatusBadge status={comm.status} />
                          </div>
                          <p className="text-text-muted text-[11px] mt-0.5">
                            {getFriendlyTemplateName(comm.template)}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-text-muted whitespace-nowrap sm:text-right pl-11 sm:pl-0">
                        {new Date(comm.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
