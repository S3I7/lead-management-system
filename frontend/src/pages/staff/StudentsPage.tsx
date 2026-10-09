import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Lead, Student } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Search } from 'lucide-react';

/** One row per child; expand to see every Writathon they joined. */
export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [history, setHistory] = useState<Lead[]>([]);

  const load = () => api.get<Student[]>(`/students?limit=1000&search=${encodeURIComponent(search.trim())}`).then((r) => setStudents(r.data));
  useEffect(() => { load(); }, []);

  const toggle = async (id: number) => {
    if (openId === id) return setOpenId(null);
    const r = await api.get<{ registrations: Lead[] }>(`/students/${id}`);
    setHistory(r.data.registrations);
    setOpenId(id);
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">Students</h1>
          <p className="text-xs text-text-muted mt-1">Each child appears once, with their participation history across Writathons.</p>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative mt-6">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by child, parent, email, or school..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </form>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-card shadow-subtle border border-app-border overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Child</th>
                <th className="py-3.5 px-4">Parent</th>
                <th className="py-3.5 px-4">School & Grade</th>
                <th className="py-3.5 px-4">Writathons</th>
                <th className="py-3.5 px-4 text-right">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <React.Fragment key={s.id}>
                  <tr className="hover:bg-primary-soft/20">
                    <td className="py-3.5 px-4 font-bold text-text-dark">{s.child_name}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold">{s.parent_name}</div>
                      <div className="text-[11px] text-text-muted">{s.parent_email} · {s.parent_phone}</div>
                    </td>
                    <td className="py-3.5 px-4 text-text-muted">{s.grade} · {s.school}</td>
                    <td className="py-3.5 px-4 font-semibold">{s.registration_count}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button onClick={() => toggle(s.id)} aria-expanded={openId === s.id} className="btn-secondary text-xs py-1.5 px-3">
                        {openId === s.id ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                  {openId === s.id && history.map((l) => (
                    <tr key={l.id} className="bg-gray-50/60">
                      <td className="py-2.5 px-4 pl-8 text-primary font-bold">
                        <Link to={`/admin/leads/${l.id}`}>{l.lead_id}</Link>
                      </td>
                      <td className="py-2.5 px-4">{l.writathon_name}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={l.status} /></td>
                      <td className="py-2.5 px-4">{l.submission_status ? <StatusBadge status={l.submission_status} /> : 'Not submitted'}</td>
                      <td className="py-2.5 px-4 text-right text-text-muted">{new Date(l.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-text-muted">No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
