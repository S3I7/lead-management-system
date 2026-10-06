import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Writathon } from '../../api/client';
import { Sparkles, CheckCircle2, BookOpen, Send, Calendar, ShieldCheck, HeartHandshake } from 'lucide-react';

export const InterestFormPage: React.FC = () => {
  const navigate = useNavigate();
  const [writathons, setWritathons] = useState<Writathon[]>([]);
  const [selectedWritathonId, setSelectedWritathonId] = useState<number | ''>('');
  
  // Form fields
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState<number>(10);
  const [childDob, setChildDob] = useState('');
  const [grade, setGrade] = useState('Grade 5');
  const [school, setSchool] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [country, setCountry] = useState('India');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<{ lead_id: string; access_token: string } | null>(null);

  useEffect(() => {
    const fetchWritathons = async () => {
      try {
        const res = await api.get<Writathon[]>('/writathons?active_only=true');
        setWritathons(res.data);
        if (res.data.length > 0) {
          setSelectedWritathonId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch writathons:', err);
      }
    };
    fetchWritathons();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!termsAccepted) {
      setErrorMessage('Please accept the Terms & Conditions to proceed.');
      return;
    }
    if (!selectedWritathonId) {
      setErrorMessage('Please select a Writathon edition.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        writathon_id: Number(selectedWritathonId),
        child_name: childName,
        child_dob: childDob || null,
        child_age: Number(childAge),
        grade,
        school,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        country,
        terms_accepted: termsAccepted,
      };

      const res = await api.post('/leads/register', payload);
      setSuccessData({
        lead_id: res.data.lead_id,
        access_token: res.data.access_token,
      });
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to submit interest registration.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCampaign = writathons.find((w) => w.id === selectedWritathonId);

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-14 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-soft text-primary px-4 py-1.5 rounded-pill text-xs font-bold tracking-wide uppercase mb-4 shadow-xs">
            <Sparkles className="w-4 h-4 text-secondary" />
            Writathon 2026 — Young Storytellers Edition
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-text-dark tracking-tight leading-tight">
            Register Your Interest in <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent">
              Creative Story Writing
            </span>
          </h1>
          <p className="mt-4 text-lg text-text-main max-w-2xl mx-auto leading-relaxed">
            Give your child the joyful stage to express original ideas, receive dedicated editorial feedback, 
            and see their stories published in our nationwide literary anthology.
          </p>
        </div>
      </section>

      {/* Main Registration Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        {successData ? (
          /* Registration Success Modal Card */
          <div className="bg-white rounded-card p-8 md:p-10 shadow-elevated border-2 border-emerald-300 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-text-dark">
              Registration Successful!
            </h2>
            <p className="text-text-main mt-2">
              A welcome confirmation email with complete guidelines has been dispatched to <strong>{parentEmail}</strong>.
            </p>

            <div className="my-6 p-6 bg-primary-soft/50 rounded-2xl border border-primary/20 max-w-md mx-auto">
              <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Assigned Unique Lead ID</span>
              <div className="text-3xl font-heading font-extrabold text-primary mt-1 tracking-wide">
                {successData.lead_id}
              </div>
              <p className="text-xs text-text-muted mt-2">
                Save this reference ID. You will also use it to check review progress.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
              <button
                onClick={() => navigate(`/submit-story/${successData.lead_id}?token=${successData.access_token}`)}
                className="btn-primary w-full sm:w-auto"
              >
                <BookOpen className="w-4 h-4" />
                Submit Story Now
              </button>
              <button
                onClick={() => navigate(`/status/${successData.lead_id}`)}
                className="btn-secondary w-full sm:w-auto"
              >
                View Registration Status
              </button>
            </div>
          </div>
        ) : (
          /* Form Card */
          <div className="bg-white rounded-card p-6 md:p-10 shadow-subtle border border-app-border">
            <form onSubmit={handleSubmit} className="space-y-8">
              {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Campaign Picker */}
              <div>
                <label className="block text-sm font-bold text-text-dark mb-2">
                  Select Writathon Edition *
                </label>
                <select
                  value={selectedWritathonId}
                  onChange={(e) => setSelectedWritathonId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none transition bg-white"
                  required
                >
                  {writathons.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}) — Deadline: {new Date(w.submission_deadline).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                {selectedCampaign && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-xl text-xs text-text-muted space-y-1 border border-gray-200">
                    <p><strong>Guidelines:</strong> {selectedCampaign.guidelines}</p>
                    <p><strong>Publication Fee upon Eligibility:</strong> {selectedCampaign.submission_fee} {selectedCampaign.currency}</p>
                  </div>
                )}
              </div>

              {/* Child Details Section */}
              <div className="border-t border-app-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center text-sm">
                    1
                  </span>
                  <h3 className="text-lg font-heading font-bold text-text-dark">
                    Child's Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">
                      Child Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Aarav Sharma"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-text-main mb-1.5">
                        Age *
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="18"
                        value={childAge}
                        onChange={(e) => setChildAge(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-main mb-1.5">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={childDob}
                        onChange={(e) => setChildDob(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">
                      Grade / Class *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Grade 5"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">
                      School Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Delhi Public School"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Parent Details Section */}
              <div className="border-t border-app-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-full bg-secondary-soft text-secondary font-bold flex items-center justify-center text-sm">
                    2
                  </span>
                  <h3 className="text-lg font-heading font-bold text-text-dark">
                    Parent / Guardian Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">
                      Parent / Guardian Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Sharma"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">
                      Email Address (For Confirmation & Updates) *
                    </label>
                    <input
                      type="email"
                      placeholder="parent@example.com"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">
                      Phone Number (WhatsApp updates) *
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">
                      Country *
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Consent and Submit */}
              <div className="border-t border-app-border pt-6">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                  />
                  <span className="text-xs text-text-main leading-relaxed">
                    I agree to the Writathon participation rules. I consent to receive confirmation, reminder,
                    and editorial result emails concerning my child's submission.
                  </span>
                </label>

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full md:w-auto px-8 py-3 text-base"
                  >
                    {isLoading ? (
                      'Creating Registration...'
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Interest & Register Lead
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
