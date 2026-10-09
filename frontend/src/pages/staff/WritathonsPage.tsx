import React, { useEffect, useState } from 'react';
import { api, Writathon } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const STATUSES: Writathon['status'][] = ['DRAFT', 'ACTIVE', 'SUBMISSIONS_CLOSED', 'COMPLETED'];
const inputCls = 'w-full px-3 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary';
const empty = { name: '', code: '', start_date: '', end_date: '', submission_deadline: '', submission_fee: '499', currency: 'INR', guidelines: '' };

export const WritathonsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [writathons, setWritathons] = useState<Writathon[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => api.get<Writathon[]>('/writathons').then((r) => setWritathons(r.data));
  useEffect(() => { load(); }, []);

  const startEdit = (w: Writathon) => {
    setEditingId(w.id);
    setForm({
      name: w.name, code: w.code, start_date: w.start_date.slice(0, 10), end_date: w.end_date.slice(0, 10),
      submission_deadline: w.submission_deadline.slice(0, 10), submission_fee: String(w.submission_fee),
      currency: w.currency, guidelines: w.guidelines || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setForm(empty); setError(''); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = { ...form, submission_fee: Number(form.submission_fee) };
      if (editingId) {
        const { code: _code, ...changes } = body;
        await api.put(`/writathons/${editingId}`, changes);
      } else {
        await api.post('/writathons', { ...body, status: 'DRAFT' });
      }
      cancelEdit();
      load();
    } catch (err: any) {
      setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Could not save Writathon. Check all fields.');
    }
  };

  const setStatus = async (id: number, status: string) => {
    await api.put(`/writathons/${id}`, { status });
    load();
  };

  const field = (key: keyof typeof empty, label: string, type = 'text', disabled = false) => (
    <label className="block text-xs font-bold text-text-dark">
      {label}
      <input
        type={type}
        required={key !== 'guidelines'}
        disabled={disabled}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={`${inputCls} mt-1 font-normal`}
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">Writathon Events</h1>
          <p className="text-xs text-text-muted mt-1">
            Create events and move them through Draft → Active (registrations open) → Submissions closed → Completed.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        <div className="bg-white rounded-card shadow-subtle border border-app-border overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Dates</th>
                <th className="py-3.5 px-4">Deadline</th>
                <th className="py-3.5 px-4">Fee</th>
                <th className="py-3.5 px-4">Status</th>
                {isAdmin && <th className="py-3.5 px-4 text-right">Edit</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {writathons.map((w) => (
                <tr key={w.id}>
                  <td className="py-3.5 px-4 font-bold text-text-dark">{w.name}</td>
                  <td className="py-3.5 px-4">{w.code}</td>
                  <td className="py-3.5 px-4 text-text-muted">
                    {new Date(w.start_date).toLocaleDateString()} – {new Date(w.end_date).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-text-muted">{new Date(w.submission_deadline).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4">{w.submission_fee} {w.currency}</td>
                  <td className="py-3.5 px-4">
                    <select
                      aria-label={`Status of ${w.name}`}
                      value={w.status}
                      disabled={!isAdmin}
                      onChange={(e) => setStatus(w.id, e.target.value)}
                      className={inputCls}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  {isAdmin && (
                    <td className="py-3.5 px-4 text-right">
                      <button onClick={() => startEdit(w)} className="btn-secondary text-xs py-1.5 px-3">Edit</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isAdmin && (
          <form onSubmit={save} className="bg-white rounded-card p-6 shadow-subtle border border-app-border space-y-4">
            <h2 className="font-heading font-bold text-text-dark">{editingId ? `Edit ${form.name}` : 'New Writathon'}</h2>
            {error && <p className="text-xs text-rose-600 font-semibold" role="alert">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {field('name', 'Name')}
              {field('code', 'Code (unique, e.g. WR2027)', 'text', editingId !== null)}
              {field('submission_fee', 'Fee', 'number')}
              {field('currency', 'Currency')}
              {field('start_date', 'Start date', 'date')}
              {field('end_date', 'End date', 'date')}
              {field('submission_deadline', 'Submission deadline', 'date')}
            </div>
            <label className="block text-xs font-bold text-text-dark">
              Guidelines
              <textarea
                value={form.guidelines}
                onChange={(e) => setForm({ ...form, guidelines: e.target.value })}
                rows={3}
                className={`${inputCls} mt-1 font-normal`}
              />
            </label>
            {!editingId && <p className="text-[11px] text-text-muted">Created as Draft; set it to Active to open registrations.</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-xs py-2 px-5">{editingId ? 'Save changes' : 'Create Writathon'}</button>
              {editingId && <button type="button" onClick={cancelEdit} className="btn-secondary text-xs py-2 px-5">Cancel</button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
