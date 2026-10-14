import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, Lead, User, Writathon } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { Search, RefreshCw, Users, ArrowRight, Download, X, AlertTriangle, UserCheck, UserPlus, BookOpen, Award, FileText } from 'lucide-react';

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
const STANDARD_CATEGORIES = ['Short Story', 'Poem', 'Novella', 'Comics'];

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

  // Dynamic set of available categories including standards, active filter, and loaded lead categories
  const [knownCategories, setKnownCategories] = useState<string[]>(() => {
    const initial = [...STANDARD_CATEGORIES];
    if (
      categoryFilter?.trim() &&
      categoryFilter.toLowerCase() !== 'other' &&
      !initial.some((c) => c.toLowerCase() === categoryFilter.trim().toLowerCase())
    ) {
      initial.push(categoryFilter.trim());
    }
    return initial.sort((a, b) => a.localeCompare(b));
  });

  useEffect(() => {
    if (leads.length > 0) {
      setKnownCategories((prev) => {
        const set = new Set(prev);
        leads.forEach((l) => {
          if (l.submission_category?.trim()) {
            set.add(l.submission_category.trim());
          }
        });
        if (categoryFilter?.trim() && categoryFilter.toLowerCase() !== 'other') {
          set.add(categoryFilter.trim());
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
      });
    }
  }, [leads, categoryFilter]);

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

  const applyQuickAssign = async (leadId: number, ownerId: number | null) => {
    try {
      await api.post('/leads/bulk-update', { lead_ids: [leadId], owner_id: ownerId });
      setMessage('Staff member assigned successfully.');
      fetchLeads();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to assign staff.');
    }
  };

  const unassignedCount = leads.filter((l) => !l.owner_id).length;

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
        <div className="max-w-[1650px] w-full mx-auto px-4 sm:px-6 lg:px-8">
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
                placeholder="Search by Lead ID, Child, Parent, Category, School, or City..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value.trim() && urlSearch) {
                    updateParam('search', '');
                  }
                }}
                className="w-full pl-10 pr-9 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    updateParam('search', '');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5 rounded-full cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
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
              {knownCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="Other">Other / Custom Categories</option>
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
          </div>

          {/* Active Filter Badges */}
          {(categoryFilter || paymentFilter || statusFilter || writathonFilter || ownerFilter || submittedFilter || ageFilter || urlSearch) && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2 animate-fadeIn">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Active filters:</span>

              {statusFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                  Status: {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label || statusFilter}
                  <button
                    type="button"
                    onClick={() => updateParam('status_filter', '')}
                    aria-label="Remove status filter"
                    className="hover:bg-primary/20 p-0.5 rounded-full cursor-pointer transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {writathonFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                  <Award className="w-3 h-3 text-amber-600" />
                  Writathon: {writathons.find((w) => String(w.id) === writathonFilter)?.name || 'Event #' + writathonFilter}
                  <button
                    type="button"
                    onClick={() => updateParam('writathon_id', '')}
                    aria-label="Remove writathon filter"
                    className="hover:bg-amber-200/60 p-0.5 rounded-full cursor-pointer transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {ownerFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                  <UserCheck className="w-3 h-3 text-indigo-600" />
                  Owner: {ownerFilter === '0' ? 'Unassigned' : team.find((u) => String(u.id) === ownerFilter)?.full_name || (ownerFilter === String(user?.id) ? 'My Leads' : 'Owner #' + ownerFilter)}
                  <button
                    type="button"
                    onClick={() => updateParam('owner_id', '')}
                    aria-label="Remove owner filter"
                    className="hover:bg-indigo-200/60 p-0.5 rounded-full cursor-pointer transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {submittedFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  <FileText className="w-3 h-3 text-emerald-600" />
                  Submission: {submittedFilter === 'true' ? 'Story submitted' : 'Not submitted yet'}
                  <button
                    type="button"
                    onClick={() => updateParam('submitted', '')}
                    aria-label="Remove submission filter"
                    className="hover:bg-emerald-200/60 p-0.5 rounded-full cursor-pointer transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {ageFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-50 text-pink-800 border border-pink-200 shadow-2xs">
                  <Users className="w-3 h-3 text-pink-600" />
                  Age: {ageFilter.replace('-', '–')} yrs
                  <button
                    type="button"
                    onClick={() => updateParam('age_group', '')}
                    aria-label="Remove age filter"
                    className="hover:bg-pink-200/60 p-0.5 rounded-full cursor-pointer transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {categoryFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                  <BookOpen className="w-3 h-3 text-purple-600" />
                  Category: {categoryFilter.toLowerCase() === 'other' ? 'Other / Custom' : categoryFilter}
                  <button
                    type="button"
                    onClick={() => updateParam('submission_category', '')}
                    aria-label="Remove category filter"
                    className="hover:bg-purple-200/60 p-0.5 rounded-full cursor-pointer transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {paymentFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs">
                  Payment: {paymentFilter}
                  <button
                    type="button"
                    onClick={handleClearPaymentFilter}
                    aria-label="Remove payment filter"
                    className="hover:bg-teal-200/60 p-0.5 rounded-full cursor-pointer transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {urlSearch && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                  <Search className="w-3 h-3 text-blue-600" />
                  Search: "{urlSearch}"
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); updateParam('search', ''); }}
                    aria-label="Clear search"
                    className="hover:bg-blue-200/60 p-0.5 rounded-full cursor-pointer transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetAllFilters}
                className="text-xs text-text-muted hover:text-red-600 underline ml-auto cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-[1650px] w-full mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-4">
        {/* Unassigned Staff Assignment Reminder Banner */}
        {unassignedCount > 0 && !isLoading && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/80 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 border border-amber-300/60">
                    Assignment Reminder
                  </span>
                  <h4 className="font-heading font-extrabold text-sm text-amber-950">
                    {unassignedCount} Lead{unassignedCount > 1 ? 's' : ''} Awaiting Staff Assignment
                  </h4>
                </div>
                <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
                  {user?.role === 'ADMIN'
                    ? 'These registrations currently have no assigned reviewer. Assign a team member to manage editorial check and parent contact.'
                    : 'Unassigned registrations are waiting to be claimed or allocated for story review.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {user?.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => {
                    const unassignedIds = leads.filter((l) => !l.owner_id).map((l) => l.id);
                    setSelected(new Set(unassignedIds));
                  }}
                  className="btn-secondary text-xs py-2 px-3.5 bg-white border-amber-300 text-amber-900 hover:bg-amber-100/60 shadow-2xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Select All Unassigned ({unassignedCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => updateParam('owner_id', '0')}
                className="btn-primary text-xs py-2 px-4 shadow-sm"
              >
                <span>Filter Unassigned</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
                    <option value="">Assign staff reviewer…</option>
                    <option value="none">Unassign</option>
                    {team.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                  <button
                    disabled={!bulkOwner}
                    onClick={() => applyBulk({ owner_id: bulkOwner === 'none' ? null : Number(bulkOwner) })}
                    className="btn-primary text-xs py-1.5 px-3 shadow-xs"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Assign to Staff
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
          <button onClick={exportCsv} disabled={leads.length === 0} className="btn-primary text-xs py-1.5 px-3 ml-auto inline-flex items-center gap-1 shadow-xs">
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
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs min-w-[1260px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3.5 px-3 w-12 text-center">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))}
                        className="w-5 h-5 rounded-md border-2 border-gray-300 text-primary accent-primary focus:ring-primary focus:ring-2 cursor-pointer transition-transform hover:scale-110"
                      />
                    </th>
                    <th className="py-3.5 px-3 min-w-[130px]">Lead ID</th>
                    <th className="py-3.5 px-3 min-w-[160px]">Child / Student</th>
                    <th className="py-3.5 px-3 min-w-[180px]">Parent Details</th>
                    <th className="py-3.5 px-3 min-w-[190px]">Writathon</th>
                    <th className="py-3.5 px-3 min-w-[140px]">Category</th>
                    <th className="py-3.5 px-3 min-w-[180px]">Staff Reviewer</th>
                    <th className="py-3.5 px-3 min-w-[120px]">Lead Status</th>
                    <th className="py-3.5 px-3 min-w-[120px]">Story</th>
                    <th className="py-3.5 px-3 min-w-[110px] whitespace-nowrap">Registered</th>
                    <th className="py-3.5 px-4 min-w-[110px] text-right sticky right-0 bg-gray-50/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] z-10">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-primary-soft/20 transition-colors">
                      <td className="py-3.5 px-3 w-12 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.lead_id}`}
                          checked={selected.has(lead.id)}
                          onChange={() => toggle(lead.id)}
                          className="w-5 h-5 rounded-md border-2 border-gray-300 text-primary accent-primary focus:ring-primary focus:ring-2 cursor-pointer transition-transform hover:scale-110"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-bold text-primary whitespace-nowrap font-mono">{lead.lead_id}</td>
                      <td className="py-3.5 px-3 min-w-[160px]">
                        <div className="font-bold text-text-dark whitespace-nowrap">{lead.child_name}</div>
                        <div className="text-[11px] text-text-muted whitespace-nowrap">Age {lead.age_group ?? lead.child_age} · {lead.grade}</div>
                        {lead.school && <div className="text-[11px] text-gray-400 truncate max-w-[160px]" title={lead.school}>{lead.school}</div>}
                      </td>
                      <td className="py-3.5 px-3 min-w-[180px]">
                        <div className="font-semibold text-text-dark whitespace-nowrap">{lead.parent_name}</div>
                        <div className="text-[11px] text-text-muted truncate max-w-[180px]" title={lead.parent_email}>{lead.parent_email}</div>
                        <div className="text-[11px] text-gray-400 whitespace-nowrap">{lead.parent_phone}</div>
                      </td>
                      <td className="py-3.5 px-3 text-text-muted min-w-[190px]">
                        <span className="font-medium text-gray-700 block max-w-[240px]">{lead.writathon_name}</span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap min-w-[140px]">
                        {(() => {
                          const cat = lead.submission_category;
                          if (!cat) return <span className="text-gray-400 text-xs italic">Unspecified</span>;
                          const isSelected = categoryFilter.toLowerCase() === cat.toLowerCase();
                          const isStandard = STANDARD_CATEGORIES.some((sc) => sc.toLowerCase() === cat.toLowerCase());
                          return (
                            <button
                              type="button"
                              onClick={() => updateParam('submission_category', isSelected ? '' : cat)}
                              title={isSelected ? `Remove filter for ${cat}` : `Filter by category "${cat}"`}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs group ${
                                isSelected
                                  ? 'bg-purple-600 text-white border border-purple-600 shadow-xs'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200/80 hover:bg-purple-100 hover:border-purple-300'
                              }`}
                            >
                              <BookOpen className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-purple-500 group-hover:scale-110 transition-transform'}`} />
                              <span>{cat}</span>
                              {!isStandard && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-200/80 text-purple-900 font-bold uppercase tracking-wider">
                                  Other
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-3 min-w-[180px]">
                        {lead.owner_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center text-[10px] shrink-0 border border-primary/20">
                              {lead.owner_name.charAt(0)}
                            </div>
                            <span className="font-semibold text-text-dark text-xs">{lead.owner_name}</span>
                          </div>
                        ) : user?.role === 'ADMIN' ? (
                          <div className="relative">
                            <select
                              aria-label={`Assign staff to ${lead.lead_id}`}
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  applyQuickAssign(lead.id, Number(e.target.value));
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100/80 cursor-pointer outline-none focus:ring-2 focus:ring-primary shadow-2xs transition"
                            >
                              <option value="" disabled>⚠️ Assign Staff (Reminder)</option>
                              {team.map((u) => (
                                <option key={u.id} value={u.id}>
                                  Assign to {u.full_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Needs Staff Assignment
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 min-w-[120px] whitespace-nowrap"><StatusBadge status={lead.status} /></td>
                      <td className="py-3.5 px-3 min-w-[120px] whitespace-nowrap">
                        {lead.submission_status ? <StatusBadge status={lead.submission_status} /> : <span className="text-gray-400">Not submitted</span>}
                      </td>
                      <td className="py-3.5 px-3 text-text-muted whitespace-nowrap font-medium min-w-[110px]">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] z-10 min-w-[110px]">
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
