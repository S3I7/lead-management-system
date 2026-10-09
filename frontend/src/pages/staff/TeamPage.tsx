import React, { useEffect, useState } from 'react';
import { api, User } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const inputCls = 'px-3 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary';
const empty = { full_name: '', email: '', password: '', role: 'STAFF' };

/** Admin-only: team members who can log in, own leads and review stories. */
export const TeamPage: React.FC = () => {
  const { user: me } = useAuth();
  const [team, setTeam] = useState<User[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const load = () => api.get<User[]>('/users').then((r) => setTeam(r.data));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setForm(empty);
      load();
    } catch (err: any) {
      setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Could not create user.');
    }
  };

  const update = async (id: number, body: Partial<Pick<User, 'role' | 'is_active'>>) => {
    await api.patch(`/users/${id}`, body);
    load();
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">Team & Access</h1>
          <p className="text-xs text-text-muted mt-1">
            Staff manage leads and reviews. Admins also manage Writathons, email templates and the team.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        <div className="bg-white rounded-card shadow-subtle border border-app-border overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {team.map((u) => (
                <tr key={u.id}>
                  <td className="py-3.5 px-4 font-bold text-text-dark">{u.full_name}</td>
                  <td className="py-3.5 px-4 text-text-muted">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <select
                      aria-label={`Role of ${u.full_name}`}
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={(e) => update(u.id, { role: e.target.value as User['role'] })}
                      className={inputCls}
                    >
                      <option value="STAFF">Staff</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      disabled={u.id === me?.id}
                      onClick={() => update(u.id, { is_active: !u.is_active })}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      {u.is_active ? 'Active · Disable' : 'Disabled · Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={create} className="bg-white rounded-card p-6 shadow-subtle border border-app-border space-y-3">
          <h2 className="font-heading font-bold text-text-dark">Add team member</h2>
          {error && <p className="text-xs text-rose-600 font-semibold" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <input aria-label="Full name" required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} />
            <input aria-label="Email" required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            <input aria-label="Temporary password" required minLength={8} type="password" placeholder="Temporary password (8+)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} />
            <select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button type="submit" className="btn-primary text-xs py-2 px-5">Add</button>
          </div>
        </form>
      </div>
    </div>
  );
};
