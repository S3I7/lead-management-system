import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api, LeadDetail } from '../../api/client';
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles, Shield, ArrowRight } from 'lucide-react';

export const StorySubmissionPage: React.FC = () => {
  const { leadId: paramLeadId } = useParams<{ leadId?: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const navigate = useNavigate();

  const [leadIdentifier, setLeadIdentifier] = useState(paramLeadId || '');
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [isVerifyingLead, setIsVerifyingLead] = useState(false);
  const [leadError, setLeadError] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [wordCount, setWordCount] = useState<string>('');
  const [category, setCategory] = useState('Fantasy & Adventure');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalityChecked, setOriginalityChecked] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Auto-verify if leadId param exists
  useEffect(() => {
    if (paramLeadId || tokenFromUrl) {
      verifyLead(tokenFromUrl || paramLeadId || '');
    }
  }, [paramLeadId, tokenFromUrl]);

  const verifyLead = async (queryId: string) => {
    if (!queryId.trim()) return;
    setIsVerifyingLead(true);
    setLeadError('');
    try {
      const endpoint = queryId.startsWith('WR-') 
        ? `/leads/by-code/${queryId.trim()}` 
        : `/leads/by-token/${queryId.trim()}`;
      const res = await api.get<LeadDetail>(endpoint);
      setLeadDetail(res.data);
      if (res.data.submission) {
        setTitle(res.data.submission.title);
        if (res.data.submission.word_count) setWordCount(String(res.data.submission.word_count));
        if (res.data.submission.category) setCategory(res.data.submission.category);
      }
    } catch (err: any) {
      setLeadError(err.response?.data?.detail || 'Could not locate registration for this ID.');
      setLeadDetail(null);
    } finally {
      setIsVerifyingLead(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];
      const isExtValid = file.name.endsWith('.pdf') || file.name.endsWith('.docx');
      if (!isExtValid && !validTypes.includes(file.type)) {
        setSubmitError('Invalid file format. Please upload a genuine DOCX or PDF file.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setSubmitError('File size exceeds the 25MB maximum limit.');
        return;
      }
      setSubmitError('');
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadDetail) {
      setSubmitError('Please verify your registration lead ID before submitting.');
      return;
    }
    if (!selectedFile && !leadDetail.submission) {
      setSubmitError('Please attach your story document (DOCX or PDF).');
      return;
    }
    if (!originalityChecked) {
      setSubmitError('Please confirm the originality declaration statement.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('lead_token', leadDetail.lead.access_token);
      formData.append('title', title);
      if (wordCount) formData.append('word_count', wordCount);
      if (category) formData.append('category', category);
      formData.append('originality_declaration', 'true');
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await api.post('/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || 'Story submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      {/* Header */}
      <section className="py-12 bg-hero-gradient-2 border-b border-app-border text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-1.5 bg-primary-soft text-primary px-3.5 py-1 rounded-pill text-xs font-bold uppercase tracking-wider mb-3">
            <Upload className="w-3.5 h-3.5" />
            Step 2 of the Writathon Journey
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-text-dark">
            Upload & Submit Your Child's Story
          </h1>
          <p className="mt-2 text-text-muted text-sm md:text-base max-w-xl mx-auto">
            Accepted formats: <strong>DOCX or PDF</strong> (max 25MB). Original author work only.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 -mt-4">
        {isSuccess ? (
          <div className="bg-white rounded-card p-8 md:p-10 shadow-elevated border-2 border-emerald-300 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-text-dark">
              Story Successfully Submitted! 🎉
            </h2>
            <p className="text-text-main mt-2">
              We have received <strong>"{title}"</strong> by <strong>{leadDetail?.lead.child_name}</strong>.
            </p>
            <div className="my-6 p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-200">
              ✓ Submission confirmation email dispatched.<br />
              ✓ Automatic reminder emails have now been safely stopped.<br />
              ✓ Queued for human editorial review & originality assessment.
            </div>
            <button
              onClick={() => navigate(`/status/${leadDetail?.lead.lead_id}`)}
              className="btn-primary"
            >
              Track Review Status
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-card p-6 md:p-8 shadow-subtle border border-app-border">
            {/* Step 1: Lookup Registration */}
            {!leadDetail ? (
              <div className="space-y-4">
                <h3 className="text-lg font-heading font-bold text-text-dark">
                  Find Your Registration
                </h3>
                <p className="text-xs text-text-muted">
                  Enter your assigned Registration Lead ID (e.g. <code>WR-2026-000101</code>) from your confirmation email.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Lead ID (e.g. WR-2026-000101)"
                    value={leadIdentifier}
                    onChange={(e) => setLeadIdentifier(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-app-border outline-none focus:ring-2 focus:ring-primary text-sm uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => verifyLead(leadIdentifier)}
                    disabled={isVerifyingLead}
                    className="btn-primary py-2.5 px-6 text-sm"
                  >
                    {isVerifyingLead ? 'Searching...' : 'Continue'}
                  </button>
                </div>
                {leadError && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {leadError}
                  </p>
                )}
              </div>
            ) : (
              /* Verified Lead Info Banner + Submission Form */
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-4 bg-primary-soft/60 rounded-2xl border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">
                      Verified Author
                    </span>
                    <h4 className="text-lg font-heading font-bold text-text-dark">
                      {leadDetail.lead.child_name} ({leadDetail.lead.grade})
                    </h4>
                    <p className="text-xs text-text-muted">
                      Lead ID: <strong>{leadDetail.lead.lead_id}</strong> • {leadDetail.writathon.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeadDetail(null)}
                    className="text-xs text-gray-500 hover:text-black underline self-start sm:self-auto"
                  >
                    Change Lead
                  </button>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {submitError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-text-dark mb-1.5">
                    Story Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. The Enchanted Clocktower"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-dark mb-1.5">
                      Approximate Word Count
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 750"
                      value={wordCount}
                      onChange={(e) => setWordCount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-dark mb-1.5">
                      Genre / Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm bg-white"
                    >
                      <option value="Fantasy & Adventure">Fantasy & Adventure</option>
                      <option value="Sci-Fi & Space">Sci-Fi & Space</option>
                      <option value="Mystery & Detective">Mystery & Detective</option>
                      <option value="Fable & Moral Tale">Fable & Moral Tale</option>
                      <option value="Real Life & Family">Real Life & Family</option>
                      <option value="Poetry & Rhymes">Poetry & Rhymes</option>
                    </select>
                  </div>
                </div>

                {/* File Upload Zone */}
                <div>
                  <label className="block text-xs font-bold text-text-dark mb-1.5">
                    Story Document (.DOCX or .PDF) *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 hover:border-primary rounded-2xl p-6 text-center transition-colors bg-gray-50/50">
                    <input
                      type="file"
                      id="story-upload-input"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="story-upload-input" className="cursor-pointer block">
                      <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center mx-auto mb-2">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-text-dark">
                        {selectedFile ? (
                          <span className="text-primary font-bold">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                        ) : leadDetail.submission ? (
                          <span className="text-gray-700">Previously uploaded: <strong>{leadDetail.submission.file_name}</strong> (Click to replace)</span>
                        ) : (
                          'Click to browse or drop your DOCX / PDF here'
                        )}
                      </p>
                      <p className="text-[11px] text-text-muted mt-1">
                        Strictly genuine DOCX or PDF files only (Validated by file magic signature)
                      </p>
                    </label>
                  </div>
                </div>

                {/* Originality Declaration */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={originalityChecked}
                      onChange={(e) => setOriginalityChecked(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <span className="text-xs text-text-main leading-relaxed">
                      <strong>Author Declaration:</strong> I certify that this story is an authentic, original creative work
                      conceived and written by the child author named above.
                    </span>
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full sm:w-auto px-8 py-3"
                  >
                    {isSubmitting ? (
                      'Uploading & Verifying...'
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Confirm & Upload Story
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
