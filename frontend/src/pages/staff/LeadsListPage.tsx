import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, Lead, User, Writathon } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { Search, RefreshCw, Users, ArrowRight, Download, X } from 'lucide-react';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All Leads', value: '' },
  { label: 'New', value: 'NEW' },
  { label: 'Contacted', value: 'CONTACTED' },
  { label: 'Reminder Sent', value: 'REMINDER_SENT' },
  { label: 'Story Submitted', value: 'STORY_SUBMITTED' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Eligible', value: 'ELIGIBLE' },
  { label: 'Not Eligible', value: 'NOT_ELIGIBLE' },
  { label: 'Payment Pending', value: 'PAYMENT_PENDING' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Completed', value: 'COMPLETED' },
];

const MANUAL_STATUSES = ['NEW', 'CONTACTED', 'REMINDER_SENT'];

const selectCls = 'px-3 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary';

const toCsv = (rows: Lead[]) => {
  const cols: (keyof Lead)[] = ['lead_id', 'writathon_name', 'child_name', 'age_group', 'submission_category', 'grade', 'school', 'city', 'parent_name',
    'parent_email', 'parent_phone', 'country', 'status', 'submission_status', 'owner_name', 'created_at'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
};

export const LeadsListPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [writathons, setWritathons] = useState<Writathon[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOwner, setBulkOwner] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [message, setMessage] = useState('');
  const [total, setTotal] = useState(0);

  // Read filter values directly from URL searchParams (single source of truth)
  const urlStatus = searchParams.get('status_filter') || searchParams.get('status') || '';
  const statusFilter = STATUS_FILTERS.some((f) => f.value === urlStatus) ? urlStatus : '';
  const paymentFilter = searchParams.get('payment_status') || '';
  const writathonFilter = searchParams.get('writathon_id') || '';
  const ownerFilter = searchParams.get('owner_id') || '';
  const submittedFilter = searchParams.get('submitted') || '';
  const ageFilter = searchParams.get('age_group') || '';
  const categoryFilter = searchParams.get('submission_category') || '';
  const urlSearch = searchParams.get('search') || '';

  // Local state for search input text
  const [searchInput, setSearchInput] = useState(urlSearch);

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  const updateParam = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
      if (key === 'status_filter') nextParams.delete('status');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const fetchLeads = async (activeRef = { current: true }) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '1000' });
      if (statusFilter) params.append('status_filter', statusFilter);
      if (paymentFilter) params.append('payment_status', paymentFilter);
      if (writathonFilter) params.append('writathon_id', writathonFilter);
      if (ownerFilter) params.append('owner_id', ownerFilter);
      if (submittedFilter) params.append('submitted', submittedFilter);
      if (ageFilter) params.append('age_group', ageFilter);
      if (categoryFilter) params.append('submission_category', categoryFilter);
      if (urlSearch.trim()) params.append('search', urlSearch.trim());
      const res = await api.get<Lead[]>(`/leads?${params.toString()}`);
      if (!activeRef.current) return;
      setLeads(res.data);
      setTotal(Number(res.headers['x-total-count'] ?? res.data.length));
      setSelected(new Set());
    } catch (err) {
      if (!activeRef.current) return;
      console.error('Failed to fetch leads:', err);
    } finally {
      if (activeRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    api.get<Writathon[]>('/writathons').then((r) => setWritathons(r.data)).catch(() => {});
    api.get<User[]>('/users').then((r) => setTeam(r.data.filter((u) => u.is_active))).catch(() => {});
  }, []);

  useEffect(() => {
    const activeRef = { current: true };
    fetchLeads(activeRef);
    return () => {
      activeRef.current = false;
    };
  }, [statusFilter, paymentFilter, writathonFilter, ownerFilter, submittedFilter, ageFilter, categoryFilter, urlSearch]);

  const handleStatusFilterClick = (value: string) => {
    updateParam('status_filter', value);
  };

  const handleClearPaymentFilter = () => {
    updateParam('payment_status', '');
  };

  const handleResetAllFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('search', searchInput.trim());
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const allSelected = leads.length > 0 && selected.size === leads.length;

  const applyBulk = async (body: { owner_id?: number | null; status?: string }) => {
    try {
      const res = await api.post('/leads/bulk-update', { lead_ids: [...selected], ...body });
      const skipped: { id: number; reason: string }[] = res.data.skipped ?? [];
      setMessage(`Updated ${res.data.updated} lead(s).` + (skipped.length ? ` Skipped ${skipped.length}: ${skipped[0].reason}` : ''));
      fetchLeads();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Bulk update failed.');
    }
  };

  const exportCsv = async () => {
    const rows = selected.size ? leads.filter((l) => selected.has(l.id)) : leads;
    try {
      await api.post('/leads/export-audit', {
        count: rows.length,
        lead_ids: rows.map((r) => r.id),
      });
    } catch (err) {
      console.warn('Failed to audit lead export:', err);
    }
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `writathon-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">
                Writathon Registrations (Leads)
              </h1>
              <p className="text-xs text-text-muted mt-1">
                One row per student per Writathon. Filter, assign owners, update status, and export for campaigns.
              </p>
            </div>
            <button
              onClick={() => fetchLeads()}
              aria-label="Refresh"
              className="p-2.5 rounded-full bg-white border border-app-border text-gray-500 hover:text-black self-start md:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="mt-6 flex flex-col md:flex-row md:flex-wrap items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Lead ID, Child, Parent, Email, School, or City..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
            </form>
            <select aria-label="Writathon" value={writathonFilter} onChange={(e) => updateParam('writathon_id', e.target.value)} className={selectCls}>
              <option value="">All Writathons</option>
              {writathons.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {user?.role === 'ADMIN' ? (
              <select aria-label="Lead owner" value={ownerFilter} onChange={(e) => updateParam('owner_id', e.target.value)} className={selectCls}>
                <option value="">All owners</option>
                <option value="0">Unassigned</option>
                {team.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            ) : (
              <select aria-label="Lead owner" value={ownerFilter} onChange={(e) => updateParam('owner_id', e.target.value)} className={selectCls}>
                <option value="">My assigned & unassigned</option>
                <option value={String(user?.id || '')}>Only my leads</option>
                <option value="0">Unassigned</option>
              </select>
            )}
            <select aria-label="Submission" value={submittedFilter} onChange={(e) => updateParam('submitted', e.target.value)} className={selectCls}>
              <option value="">Any submission</option>
              <option value="true">Story submitted</option>
              <option value="false">Not submitted yet</option>
            </select>
            <select aria-label="Age group" value={ageFilter} onChange={(e) => updateParam('age_group', e.target.value)} className={selectCls}>
              <option value="">All ages</option>
              {['8-10', '11-13', '14-18'].map((a) => <option key={a} value={a}>{a.replace('-', '–')} yrs</option>)}
            </select>
            <select aria-label="Category" value={categoryFilter} onChange={(e) => updateParam('submission_category', e.target.value)} className={selectCls}>
              <option value="">All categories</option>
              {['Short Story', 'Poem', 'Novella', 'Comics'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto w-full py-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handleStatusFilterClick(f.value)}
                className={`px-3 py-1.5 rounded-pill text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === f.value
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-text-muted hover:bg-gray-100 border border-app-border'
                }`}
              >
                {f.label}
              </button>
            ))}
            {paymentFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold whitespace-nowrap bg-teal-50 text-teal-800 border border-teal-200 shadow-xs">
                Payment: {paymentFilter}
                <button
                  onClick={handleClearPaymentFilter}
                  aria-label="Remove payment filter"
                  className="hover:text-teal-950 p-0.5 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(statusFilter || paymentFilter || writathonFilter || ownerFilter || submittedFilter || ageFilter || categoryFilter || urlSearch) && (
              <button
                onClick={handleResetAllFilters}
                className="px-2.5 py-1 text-xs text-text-muted hover:text-red-600 underline whitespace-nowrap ml-auto"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-3">
        {/* Bulk actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-text-dark">
            {total > leads.length ? `Showing ${leads.length} of ${total} leads (narrow with filters)` : `${leads.length} lead(s)`}{selected.size > 0 && ` · ${selected.size} selected`}
          </span>
          {selected.size > 0 && (
            <>
              {user?.role === 'ADMIN' && (
                <>
                  <select aria-label="Assign owner" value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)} className={selectCls}>
                    <option value="">Assign to…</option>
                    <option value="none">Unassign</option>
                    {team.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                  <button
                    disabled={!bulkOwner}
                    onClick={() => applyBulk({ owner_id: bulkOwner === 'none' ? null : Number(bulkOwner) })}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Apply owner
                  </button>
                </>
              )}
              <select aria-label="Set status" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className={selectCls}>
                <option value="">Set status…</option>
                {/* Later statuses follow the workflow (submission, review, payment); the API rejects them here */}
                {STATUS_FILTERS.filter((f) => MANUAL_STATUSES.includes(f.value)).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <button disabled={!bulkStatus} onClick={() => applyBulk({ status: bulkStatus })} className="btn-secondary text-xs py-1.5 px-3">
                Apply status
              </button>
            </>
          )}
          <button onClick={exportCsv} disabled={leads.length === 0} className="btn-primary text-xs py-1.5 px-3 ml-auto inline-flex items-center gap-1">
            <Download className="w-3.5 h-3.5" />
            Export {selected.size ? 'selected' : 'all'} CSV
          </button>
        </div>
        {message && <p className="text-xs text-text-muted" role="status">{message}</p>}

        <div className="bg-white rounded-card shadow-subtle border border-app-border overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-text-muted">Loading leads list...</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-text-dark">No leads match your filter</p>
              <p className="text-xs text-text-muted mt-1">Try resetting the search query or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))}
                      />
                    </th>
                    <th className="py-3.5 px-4">Lead ID</th>
                    <th className="py-3.5 px-4">Child / Student</th>
                    <th className="py-3.5 px-4">Parent Details</th>
                    <th className="py-3.5 px-4">Writathon</th>
                    <th className="py-3.5 px-4">Owner</th>
                    <th className="py-3.5 px-4">Lead Status</th>
                    <th className="py-3.5 px-4">Story</th>
                    <th className="py-3.5 px-4">Registered</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-primary-soft/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.lead_id}`}
                          checked={selected.has(lead.id)}
                          onChange={() => toggle(lead.id)}
                        />
                      </td>
                      <td className="py-3.5 px-4 font-bold text-primary whitespace-nowrap">{lead.lead_id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-text-dark">{lead.child_name}</div>
                        <div className="text-[11px] text-text-muted">Age {lead.age_group ?? lead.child_age} · {lead.grade}</div>
                        {lead.submission_category && <div className="text-[11px] text-primary font-semibold">{lead.submission_category}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-text-dark">{lead.parent_name}</div>
                        <div className="text-[11px] text-text-muted">{lead.parent_email}</div>
                        <div className="text-[11px] text-gray-400">{lead.parent_phone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">{lead.writathon_name}</td>
                      <td className="py-3.5 px-4 text-text-muted">{lead.owner_name || <span className="text-gray-400">Unassigned</span>}</td>
                      <td className="py-3.5 px-4"><StatusBadge status={lead.status} /></td>
                      <td className="py-3.5 px-4">
                        {lead.submission_status ? <StatusBadge status={lead.submission_status} /> : <span className="text-gray-400">Not submitted</span>}
                      </td>
                      <td className="py-3.5 px-4 text-text-muted whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/admin/leads/${lead.id}`}
                          className="btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1"
                        >
                          Details
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
