import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Writathon } from '../../api/client';
import { Sparkles, CheckCircle2, BookOpen, Send, Calendar, ShieldCheck, HeartHandshake } from 'lucide-react';

const AGE_GROUPS = ['8-10', '11-13', '14-18'];
const CATEGORIES = ['Short Story', 'Poem', 'Novella', 'Comics'];
const COUNTRY_CODES: [string, string][] = [
  ['+91', 'India'], ['+1', 'US/Canada'], ['+44', 'UK'], ['+61', 'Australia'], ['+65', 'Singapore'],
  ['+971', 'UAE'], ['+974', 'Qatar'], ['+966', 'Saudi Arabia'], ['+968', 'Oman'], ['+965', 'Kuwait'],
  ['+973', 'Bahrain'], ['+60', 'Malaysia'], ['+977', 'Nepal'], ['+94', 'Sri Lanka'], ['+64', 'New Zealand'],
];
const labelCls = 'block text-xs font-semibold text-text-main mb-1.5';
const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm';

const TextField: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; minLength?: number; pattern?: string; title?: string }> = ({
  label, value, onChange, placeholder, type = 'text', minLength, pattern, title,
}) => {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input id={id} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} minLength={minLength} pattern={pattern} title={title} required />
    </div>
  );
};

export const InterestFormPage: React.FC = () => {
  const navigate = useNavigate();
  const [writathons, setWritathons] = useState<Writathon[]>([]);
  const [selectedWritathonId, setSelectedWritathonId] = useState<number | ''>('');
  
  // Form fields
  const [childFirst, setChildFirst] = useState('');
  const [childLast, setChildLast] = useState('');
  const [parentFirst, setParentFirst] = useState('');
  const [parentLast, setParentLast] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [whatsapp, setWhatsapp] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [category, setCategory] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [city, setCity] = useState('');
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
        child_name: `${childFirst.trim()} ${childLast.trim()}`,
        parent_name: `${parentFirst.trim()} ${parentLast.trim()}`,
        parent_email: parentEmail,
        parent_phone: `${countryCode} ${whatsapp.trim()}`,
        age_group: ageGroup,
        submission_category: category,
        grade,
        school,
        city,
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
            {selectedCampaign?.name || 'Writathon Registration'}
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
                Save this ID and keep it private. You need it to submit the story and to track its status.
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

              {/* Participant Details */}
              <div className="border-t border-app-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center text-sm">
                    1
                  </span>
                  <h3 className="text-lg font-heading font-bold text-text-dark">Participant Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField label="Participant First Name *" value={childFirst} onChange={setChildFirst} placeholder="e.g. Aarav" />
                  <TextField label="Participant Last Name *" value={childLast} onChange={setChildLast} placeholder="e.g. Sharma" />

                  <div>
                    <label htmlFor="age-group" className={labelCls}>Age Group *</label>
                    <select id="age-group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className={`${inputCls} bg-white`} required>
                      <option value="" disabled>Select age group</option>
                      {AGE_GROUPS.map((a) => <option key={a} value={a}>{a.replace('-', '–')} years</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="submission-category" className={labelCls}>Submission Category *</label>
                    <select id="submission-category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} bg-white`} required>
                      <option value="" disabled>Select category</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <TextField label="Class and Section *" value={grade} onChange={setGrade} placeholder="e.g. Grade 6 – B" />
                  <div>
                    <TextField label="School Name *" value={school} onChange={setSchool} placeholder="e.g. Delhi Public School" minLength={2} />
                    <p className="text-[11px] text-text-muted mt-1">May also be used for the School Spirit Award, if the event has one.</p>
                  </div>
                </div>
              </div>

              {/* Parent / Guardian Details */}
              <div className="border-t border-app-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-full bg-secondary-soft text-secondary font-bold flex items-center justify-center text-sm">
                    2
                  </span>
                  <h3 className="text-lg font-heading font-bold text-text-dark">Parent / Guardian Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField label="Parent/Guardian First Name *" value={parentFirst} onChange={setParentFirst} placeholder="e.g. Rajesh" />
                  <TextField label="Parent/Guardian Last Name *" value={parentLast} onChange={setParentLast} placeholder="e.g. Sharma" />
                  <TextField label="Email Address *" type="email" value={parentEmail} onChange={setParentEmail} placeholder="parent@gmail.com" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" title="Enter a full email address, e.g. name@gmail.com" />

                  <div>
                    <label htmlFor="whatsapp" className={labelCls}>WhatsApp Number *</label>
                    <div className="flex gap-2">
                      <select
                        aria-label="Country code"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="px-2 py-2.5 rounded-xl border border-app-border focus:ring-2 focus:ring-primary outline-none text-sm bg-white"
                      >
                        {COUNTRY_CODES.map(([code, name]) => <option key={code} value={code}>{code} {name}</option>)}
                      </select>
                      <input
                        id="whatsapp"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9 ]{6,15}"
                        title="6 to 15 digits"
                        placeholder="98765 43210"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        className={inputCls}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="border-t border-app-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center text-sm">
                    3
                  </span>
                  <h3 className="text-lg font-heading font-bold text-text-dark">Location</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField label="City *" value={city} onChange={setCity} placeholder="e.g. Chennai" minLength={2} />
                  <TextField label="Country *" value={country} onChange={setCountry} minLength={2} />
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="border-t border-app-border pt-6">
                <h3 className="text-lg font-heading font-bold text-text-dark mb-3">Terms and Conditions *</h3>
                <div className="max-h-80 overflow-y-auto p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-text-main leading-relaxed space-y-3">
                  <div>
                    <p className="font-bold text-text-dark">👩‍🎓 Who Can Participate?</p>
                    <p>Each Writathon may specify its eligible age groups and participation requirements. Please check the details provided for the selected event.</p>
                  </div>
                  <div>
                    <p className="font-bold text-text-dark">✍️ Submission Categories</p>
                    <p>Participants may submit their work in the following categories, subject to the selected Writathon's rules:</p>
                    <ul className="list-disc pl-5">
                      <li>Poems — Up to 1,000 words</li>
                      <li>Short Stories — Up to 3,000 words</li>
                      <li>Novellas — 3,000 to 10,000+ words</li>
                      <li>Comics</li>
                    </ul>
                    <p>💡 If you are submitting multiple poems, please compile them into a single Word document before uploading, if permitted by the event guidelines.</p>
                  </div>
                  <div>
                    <p className="font-bold text-text-dark">💡 Originality and Content Guidelines</p>
                    <ul className="list-disc pl-5">
                      <li>Your entry must be your own original work.</li>
                      <li>AI-generated stories are not allowed unless the specific Writathon explicitly states otherwise.</li>
                      <li>Plagiarism is strictly prohibited. Do not copy or rewrite content from books, movies, or online sources.</li>
                      <li>Fan fiction is not permitted. Your story should feature original characters and settings rather than characters or settings from existing franchises, such as Harry Potter, Marvel, or Disney.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-bold text-text-dark">🌈 What Genres Can You Write In?</p>
                    <p>You are free to choose any genre or combine genres, subject to the event guidelines. Examples include Mystery, Adventure, Sci-Fi, Romance, Fantasy, Historical Fiction, and more. Your work should be creative, original, and uniquely yours.</p>
                  </div>
                  <div>
                    <p className="font-bold text-text-dark">📂 Submission Format</p>
                    <p>Please follow the submission guidelines specified for the selected Writathon. Where applicable, the standard requirements are:</p>
                    <ul className="list-disc pl-5">
                      <li>File Format: .doc or .docx only. PDFs are not accepted unless the event explicitly permits them.</li>
                      <li>File Naming: Story Title – Author Name (Example: The Lost Treasure – John Doe)</li>
                      <li>Title: Every entry must have a title at the top of the document.</li>
                      <li>Font Style: Times New Roman, size 12, with 1.5 line spacing.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-bold text-text-dark">📅 Submission Deadline</p>
                    <p>
                      Please follow the dates and deadlines specified for the selected Writathon. Visit{' '}
                      <a href="https://learnercircle.in" target="_blank" rel="noreferrer" className="text-primary underline">LearnerCircle.in</a>{' '}
                      for more information. Late submissions may be considered for future publishing opportunities, subject to the event's policies, but may not be eligible for the current contest.
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-text-dark">📞 Need Help?</p>
                    <p>
                      Call: <a href="tel:+917358591444" className="text-primary underline">+91 73585 91444</a> · Email:{' '}
                      <a href="mailto:care@learnercircle.in" className="text-primary underline">care@learnercircle.in</a>
                    </p>
                  </div>
                </div>

                <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    required
                  />
                  <span className="text-xs text-text-main leading-relaxed">
                    I have read and agree to the Terms and Conditions.
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
