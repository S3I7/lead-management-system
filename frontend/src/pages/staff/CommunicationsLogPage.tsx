import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, CommunicationLog } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Mail, Search, RefreshCw, Send, Eye, CheckCircle2 } from 'lucide-react';

export const CommunicationsLogPage: React.FC = () => {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [previewLog, setPreviewLog] = useState<CommunicationLog | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (recipientSearch.trim()) params.append('recipient', recipientSearch.trim());
      const res = await api.get<CommunicationLog[]>(`/emails/communications?${params.toString()}`);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch communications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleResend = async (commId: number) => {
    try {
      await api.post(`/emails/communications/resend/${commId}`);
      setActionMessage('Email re-dispatched and recorded in audit log.');
      await fetchLogs();
    } catch (err) {
      setActionMessage('Failed to resend email.');
    }
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">
                Communication Audit Log
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Complete timeline and verification records of every email dispatched by the system.
              </p>
            </div>
            <button
              onClick={fetchLogs}
              className="p-2.5 rounded-full bg-white border border-app-border text-gray-500 hover:text-black self-start md:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); fetchLogs(); }} className="mt-4 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by recipient email address..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
            </div>
          </form>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {actionMessage && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            {actionMessage}
          </div>
        )}

        <div className="bg-white rounded-card shadow-subtle border border-app-border overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-text-muted">Loading communication audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-text-dark">No emails logged yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Subject</th>
                    <th className="py-3.5 px-4">Template</th>
                    <th className="py-3.5 px-4">Recipient</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Dispatched At</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-primary-soft/20 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-text-dark">
                        {log.subject}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] bg-gray-100 text-primary px-2 py-0.5 rounded-full font-semibold">
                          {log.template}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-text-main">
                        {log.recipient}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="py-3.5 px-4 text-text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPreviewLog(log)}
                            className="btn-ghost text-xs py-1 px-2.5 border border-app-border"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            onClick={() => handleResend(log.id)}
                            className="btn-secondary text-xs py-1 px-2.5"
                          >
                            <Send className="w-3 h-3" />
                            Resend
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Email Body Preview Modal */}
      {previewLog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-card max-w-2xl w-full p-6 shadow-elevated border border-app-border max-h-[90vh] flex flex-col animate-fadeIn">
            <div className="flex items-center justify-between border-b border-app-border pb-3 mb-4">
              <div>
                <span className="text-xs uppercase font-bold text-text-muted">Dispatched Email Audit Preview</span>
                <h3 className="text-base font-heading font-bold text-text-dark mt-0.5">
                  {previewLog.subject}
                </h3>
                <p className="text-[11px] text-text-muted">
                  Recipient: <strong>{previewLog.recipient}</strong> • Template: <code>{previewLog.template}</code>
                </p>
              </div>
              <button
                onClick={() => setPreviewLog(null)}
                className="text-gray-400 hover:text-black font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div
              className="overflow-y-auto flex-1 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs"
              dangerouslySetInnerHTML={{ __html: previewLog.body_content }}
            />

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setPreviewLog(null)}
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
