import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, LeadDetail } from '../../api/client';
import { LeadJourneyStepper } from '../../components/LeadJourneyStepper';
import { StatusBadge } from '../../components/StatusBadge';
import { 
  Search, BookOpen, Download, CreditCard, Sparkles, 
  Mail, Calendar, School, Award, AlertCircle, CheckCircle2, ExternalLink 
} from 'lucide-react';

export const ParentStatusPage: React.FC = () => {
  const { leadId: paramLeadId } = useParams<{ leadId?: string }>();
  const navigate = useNavigate();

  const [searchCode, setSearchCode] = useState(paramLeadId || '');
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (paramLeadId) fetchStatus(paramLeadId);
  }, [paramLeadId]);

  const fetchStatus = async (code: string) => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const endpoint = code.trim().toUpperCase().startsWith('WR-')
        ? `/leads/by-code/${code.trim()}`
        : `/leads/by-token/${code.trim()}`;
      const res = await api.get<LeadDetail>(endpoint);
      setLeadDetail(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration record not found.');
      setLeadDetail(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(searchCode);
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      {/* Header */}
      <section className="py-10 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-3xl font-heading font-extrabold text-text-dark">
              Track Your Writathon Journey
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Enter your unique Lead ID (e.g. <code>WR-2026-K7QX9M2P</code>) to view real-time status.
            </p>

            <form onSubmit={handleSearchSubmit} className="mt-5 flex gap-2 max-w-md mx-auto">
              <input
                type="text"
                placeholder="Enter Tracking ID (e.g. WR-2026-K7QX9M2P)"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-pill border border-app-border outline-none focus:ring-2 focus:ring-primary text-sm uppercase bg-white shadow-xs"
              />
              <button type="submit" className="btn-primary py-2.5 px-6 text-sm">
                <Search className="w-4 h-4" />
                Track
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        {isLoading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-text-muted">Loading journey details...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-card bg-rose-50 border border-rose-200 text-rose-700 text-sm max-w-md mx-auto text-center">
            <AlertCircle className="w-6 h-6 mx-auto mb-1 text-rose-500" />
            {error}
          </div>
        )}

        {leadDetail && !isLoading && (
          <div className="space-y-6">
            {/* Visual Stepper */}
            <LeadJourneyStepper
              currentStatus={leadDetail.lead.status}
              hasSubmission={!!leadDetail.submission}
              plagiarismChecked={leadDetail.plagiarism_review?.status !== 'NOT_CHECKED'}
              isEligible={leadDetail.lead.status === 'ELIGIBLE' || leadDetail.story_review?.decision === 'ELIGIBLE'}
              isPaid={leadDetail.payment?.status === 'PAID'}
              isPublished={leadDetail.publication?.publication_status === 'PUBLISHED'}
            />

            {/* Author & Journey Header Card */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-heading font-extrabold text-text-dark">
                    {leadDetail.lead.child_name}
                  </h2>
                  <StatusBadge status={leadDetail.lead.status} />
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Lead ID: <strong className="text-primary">{leadDetail.lead.lead_id}</strong> • Age {leadDetail.lead.age_group ?? leadDetail.lead.child_age} • {leadDetail.lead.grade} • {leadDetail.lead.school}
                </p>
                <p className="text-xs text-text-muted">
                  Campaign: <strong>{leadDetail.writathon.name}</strong> • Parent: {leadDetail.lead.parent_name} ({leadDetail.lead.parent_email})
                </p>
              </div>

              {/* Action buttons based on status */}
              <div className="flex flex-wrap items-center gap-2">
                {!leadDetail.submission && (
                  <button
                    onClick={() => navigate(`/submit-story/${leadDetail.lead.lead_id}?token=${leadDetail.lead.access_token}`)}
                    className="btn-primary text-sm py-2 px-5"
                  >
                    <BookOpen className="w-4 h-4" />
                    Submit Story
                  </button>
                )}

                {leadDetail.payment && leadDetail.payment.status !== 'PAID' && leadDetail.lead.status === 'PAYMENT_PENDING' && (
                  <button
                    onClick={() => navigate(`/payment/${leadDetail.payment?.payment_link_token}`)}
                    className="btn-primary text-sm py-2 px-5"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pay Publication Fee
                  </button>
                )}
              </div>
            </div>

            {/* Grid of Story & Status Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Submission Information */}
              <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-lg text-text-dark flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Submitted Story
                  </h3>
                  {leadDetail.submission && <StatusBadge status={leadDetail.submission.status} />}
                </div>

                {leadDetail.submission ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-text-muted">Title:</span>
                      <p className="font-bold text-sm text-text-dark mt-0.5">{leadDetail.submission.title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-text-muted">Category:</span>
                        <p className="font-semibold text-text-dark">{leadDetail.submission.category || 'Creative'}</p>
                      </div>
                      <div>
                        <span className="text-text-muted">Word Count:</span>
                        <p className="font-semibold text-text-dark">{leadDetail.submission.word_count || 'N/A'} words</p>
                      </div>
                    </div>
                    <div className="pt-2">
                      <a
                        href={`http://localhost:8000${leadDetail.submission.file_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary text-xs py-1.5 px-4"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download File ({leadDetail.submission.file_name})
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs text-text-muted">No story submitted yet.</p>
                    <button
                      onClick={() => navigate(`/submit-story/${leadDetail.lead.lead_id}?token=${leadDetail.lead.access_token}`)}
                      className="btn-primary text-xs py-1.5 px-4 mt-3"
                    >
                      Upload Now
                    </button>
                  </div>
                )}
              </div>

              {/* Editorial Review & Outcome */}
              <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-lg text-text-dark flex items-center gap-2">
                    <Award className="w-5 h-5 text-secondary" />
                    Editorial Review Result
                  </h3>
                  {leadDetail.story_review && <StatusBadge status={leadDetail.story_review.decision} />}
                </div>

                {leadDetail.story_review ? (
                  <div className="space-y-3 text-xs">
                    <div className={`p-3.5 rounded-xl border ${
                      leadDetail.story_review.decision === 'ELIGIBLE'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                      <p className="font-bold mb-1">
                        {leadDetail.story_review.decision === 'ELIGIBLE'
                          ? 'Story Approved as Eligible for Publication!'
                          : 'Editorial Feedback:'}
                      </p>
                      <p className="italic">"{leadDetail.story_review.feedback}"</p>
                    </div>

                    {leadDetail.lead.status === 'PAYMENT_PENDING' && leadDetail.payment && (
                      <div className="p-3 bg-primary-soft rounded-xl border border-primary/20 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-primary">Publication Fee Pending</p>
                          <p className="text-text-muted">{leadDetail.payment.amount} {leadDetail.payment.currency}</p>
                        </div>
                        <button
                          onClick={() => navigate(`/payment/${leadDetail.payment?.payment_link_token}`)}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          Pay Now
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs text-text-muted">
                      {leadDetail.submission
                        ? 'Story is currently in our editorial queue under review.'
                        : 'Submit your child’s story to begin the editorial review process.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Publication Info Banner (if Ready or Published) */}
            {leadDetail.publication && leadDetail.publication.publication_status !== 'NOT_READY' && (
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-card p-6 text-white shadow-elevated">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      {leadDetail.publication.publication_status === 'PUBLISHED' ? 'Story Live in Anthology!' : 'Ready for Publication'}
                    </div>
                    <h3 className="text-xl font-heading font-extrabold">
                      "{leadDetail.submission?.title}" by {leadDetail.lead.child_name}
                    </h3>
                    <p className="text-xs text-white/90 mt-1">
                      {leadDetail.publication.publication_notes || 'All editorial typesetting and checks complete.'}
                    </p>
                  </div>
                  {leadDetail.publication.publication_url && (
                    <a
                      href={leadDetail.publication.publication_url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white text-primary font-bold px-5 py-2.5 rounded-pill text-xs inline-flex items-center gap-2 hover:bg-gray-100 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Published Story
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Communications Timeline */}
            <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
              <h3 className="font-heading font-bold text-lg text-text-dark flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-indigo" />
                Communication History Log
              </h3>

              {leadDetail.communications.length === 0 ? (
                <p className="text-xs text-text-muted">No emails recorded yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {leadDetail.communications.map((comm) => (
                    <div key={comm.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-dark">{comm.subject}</span>
                          <StatusBadge status={comm.status} />
                        </div>
                        <p className="text-text-muted mt-0.5">
                          Template: <strong>{comm.template}</strong> • Sent to: {comm.recipient}
                        </p>
                      </div>
                      <span className="text-text-muted whitespace-nowrap">
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
