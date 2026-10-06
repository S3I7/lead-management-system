import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Lead, LeadStatus } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Search, Filter, RefreshCw, Users, ArrowRight } from 'lucide-react';

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

export const LeadsListPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status_filter', statusFilter);
      if (search.trim()) params.append('search', search.trim());
      const res = await api.get<Lead[]>(`/leads?${params.toString()}`);
      setLeads(res.data);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads();
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">
                Lead Directory & Candidate Management
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Filter and inspect candidates along every milestone of the Writathon journey.
              </p>
            </div>
            <button
              onClick={fetchLeads}
              className="p-2.5 rounded-full bg-white border border-app-border text-gray-500 hover:text-black self-start md:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="mt-6 flex flex-col md:flex-row items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Lead ID, Child, Parent Name, Email, or School..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-app-border bg-white text-xs outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
            </form>

            {/* Quick Status Badges Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
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
          </div>
        </div>
      </section>

      {/* Main Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
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
              <p className="text-xs text-text-muted mt-1">Try resetting the search query or status filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Lead ID</th>
                    <th className="py-3.5 px-4">Child / Student</th>
                    <th className="py-3.5 px-4">Parent Details</th>
                    <th className="py-3.5 px-4">School & Grade</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Reminders</th>
                    <th className="py-3.5 px-4">Registered</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-primary-soft/20 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-primary">
                        {lead.lead_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-text-dark">{lead.child_name}</div>
                        <div className="text-[11px] text-text-muted">Age {lead.child_age}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-text-dark">{lead.parent_name}</div>
                        <div className="text-[11px] text-text-muted">{lead.parent_email}</div>
                        <div className="text-[11px] text-gray-400">{lead.parent_phone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">
                        <div>{lead.grade}</div>
                        <div className="text-[11px] text-gray-400 truncate max-w-[160px]">{lead.school}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">
                        <span className="font-semibold text-text-dark">{lead.reminder_count}</span> sent
                        {lead.last_reminder_sent_at && (
                          <div className="text-[10px] text-gray-400">
                            {new Date(lead.last_reminder_sent_at).toLocaleDateString()}
                          </div>
                        )}
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
