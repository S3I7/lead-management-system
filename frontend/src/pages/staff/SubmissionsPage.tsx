import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, SubmissionListItem, Writathon } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';

const STORY_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'ELIGIBLE', 'NOT_ELIGIBLE', 'APPROVED', 'PUBLISHED'];
const selectCls = 'px-3 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary';

export const SubmissionsPage: React.FC = () => {
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [writathons, setWritathons] = useState<Writathon[]>([]);
  const [writathonId, setWritathonId] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => { api.get<Writathon[]>('/writathons').then((r) => setWritathons(r.data)); }, []);
  useEffect(() => {
    const params = new URLSearchParams({ limit: '1000' });
    if (writathonId) params.append('writathon_id', writathonId);
    if (status) params.append('status_filter', status);
    api.get<SubmissionListItem[]>(`/submissions?${params}`).then((r) => setItems(r.data));
  }, [writathonId, status]);

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">Story Submissions</h1>
          <p className="text-xs text-text-muted mt-1">Every submitted story, linked to its registration and Writathon.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <select aria-label="Writathon" value={writathonId} onChange={(e) => setWritathonId(e.target.value)} className={selectCls}>
              <option value="">All Writathons</option>
              {writathons.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select aria-label="Story status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">Any status</option>
              {STORY_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-card shadow-subtle border border-app-border overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Title</th>
                <th className="py-3.5 px-4">Child</th>
                <th className="py-3.5 px-4">Writathon</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Submitted</th>
                <th className="py-3.5 px-4 text-right">Lead</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-primary-soft/20">
                  <td className="py-3.5 px-4 font-bold text-text-dark">{s.title}</td>
                  <td className="py-3.5 px-4">{s.child_name}</td>
                  <td className="py-3.5 px-4 text-text-muted">{s.writathon_name}</td>
                  <td className="py-3.5 px-4"><StatusBadge status={s.status} /></td>
                  <td className="py-3.5 px-4 text-text-muted">{new Date(s.submitted_at).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4 text-right">
                    <Link to={`/admin/leads/${s.lead_id}`} className="text-primary font-bold">{s.lead_code}</Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-text-muted">No submissions match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
