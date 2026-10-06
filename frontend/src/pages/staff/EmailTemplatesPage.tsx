import React, { useState, useEffect } from 'react';
import { api, EmailTemplate } from '../../api/client';
import { Mail, Edit3, Eye, CheckCircle2, Save, Sparkles, RefreshCw } from 'lucide-react';

export const EmailTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [previewHtml, setPreviewHtml] = useState<{ subject: string; html_body: string } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<EmailTemplate[]>('/emails/templates');
      setTemplates(res.data);
      if (res.data.length > 0 && !selectedTemplate) {
        selectTemplate(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const selectTemplate = async (tmpl: EmailTemplate) => {
    setSelectedTemplate(tmpl);
    setEditSubject(tmpl.subject_template);
    setEditBody(tmpl.body_template);
    setMessage('');
    await fetchPreview(tmpl.template_code);
  };

  const fetchPreview = async (code: string) => {
    try {
      const res = await api.post('/emails/templates/preview', {
        template_code: code,
      });
      setPreviewHtml(res.data);
    } catch (err) {
      console.error('Failed to load preview:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setIsSaving(true);
    setMessage('');
    try {
      const res = await api.put<EmailTemplate>(`/emails/templates/${selectedTemplate.id}`, {
        subject_template: editSubject,
        body_template: editBody,
      });
      setSelectedTemplate(res.data);
      setMessage('Template updated successfully!');
      await fetchPreview(res.data.template_code);
      await fetchTemplates();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to update template.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">
                Automated Email Template Management
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Customize templates and dynamic variables for every milestone in the Writathon journey.
              </p>
            </div>
            <button
              onClick={fetchTemplates}
              className="p-2.5 rounded-full bg-white border border-app-border text-gray-500 hover:text-black"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {message && (
          <div className="p-3 mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Template Selector List (4 cols) */}
          <div className="lg:col-span-4 space-y-2">
            <h2 className="text-xs uppercase font-bold tracking-wider text-text-muted mb-3 px-1">
              Workflow Templates ({templates.length})
            </h2>
            <div className="space-y-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between ${
                    selectedTemplate?.id === t.id
                      ? 'bg-primary text-white border-primary shadow-subtle'
                      : 'bg-white border-app-border hover:bg-gray-50 text-text-dark'
                  }`}
                >
                  <div>
                    <p className="font-heading font-bold text-xs">{t.name}</p>
                    <p className={`text-[10px] mt-0.5 ${selectedTemplate?.id === t.id ? 'text-white/80' : 'text-text-muted'}`}>
                      {t.template_code}
                    </p>
                  </div>
                  <Mail className={`w-4 h-4 ${selectedTemplate?.id === t.id ? 'text-white' : 'text-gray-400'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Right: Editor & Live Preview (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedTemplate && (
              <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <h3 className="font-heading font-bold text-base text-text-dark">
                    Editing: {selectedTemplate.name}
                  </h3>
                  <span className="text-[11px] font-mono bg-primary-soft text-primary px-2.5 py-1 rounded-full font-bold">
                    {selectedTemplate.template_code}
                  </span>
                </div>

                <form onSubmit={handleSave} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-xs font-bold text-text-dark mb-1">
                      Subject Line Template
                    </label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border font-medium outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-dark mb-1">
                      Email Body HTML Template (Supports <code className="text-primary font-bold">{'{{var}}'}</code> placeholders)
                    </label>
                    <textarea
                      rows={10}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-app-border font-mono text-[11px] outline-none focus:ring-2 focus:ring-primary leading-relaxed"
                      required
                    />
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] text-text-muted">
                    <strong>Available placeholders:</strong>{' '}
                    <code>{'{{child_name}}'}</code>, <code>{'{{parent_name}}'}</code>, <code>{'{{lead_id}}'}</code>,{' '}
                    <code>{'{{writathon_name}}'}</code>, <code>{'{{submission_deadline}}'}</code>,{' '}
                    <code>{'{{submission_url}}'}</code>, <code>{'{{story_title}}'}</code>,{' '}
                    <code>{'{{payment_link}}'}</code>, <code>{'{{amount}}'}</code>, <code>{'{{currency}}'}</code>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => fetchPreview(selectedTemplate.template_code)}
                      className="btn-secondary text-xs py-2 px-4"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Refresh Preview
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn-primary text-xs py-2 px-6"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? 'Saving...' : 'Save Template'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Live Rendered HTML Preview */}
            {previewHtml && (
              <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                  <Eye className="w-4 h-4 text-primary" />
                  <h3 className="font-heading font-bold text-base text-text-dark">
                    Live Sample Email Preview
                  </h3>
                </div>

                <div className="mb-3 p-3 bg-gray-50 rounded-xl border text-xs">
                  <span className="text-gray-400">Subject: </span>
                  <span className="font-bold text-text-dark">{previewHtml.subject}</span>
                </div>

                <div
                  className="p-4 bg-white rounded-xl border border-gray-200 shadow-inner max-h-[400px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: previewHtml.html_body }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
