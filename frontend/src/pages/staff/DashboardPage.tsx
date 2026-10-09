import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, DashboardStats, Lead } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, Mail, Bell, Upload, ShieldCheck, Award, 
  CreditCard, Sparkles, BookOpen, RefreshCw, ArrowUpRight, CheckCircle2 
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [schedulerMessage, setSchedulerMessage] = useState('');
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, leadsRes] = await Promise.all([
        api.get<DashboardStats>('/dashboard/stats'),
        api.get<Lead[]>('/leads?limit=8'),
      ]);
      setStats(statsRes.data);
      setRecentLeads(leadsRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRunReminders = async () => {
    setIsRunningScheduler(true);
    setSchedulerMessage('');
    try {
      const res = await api.post('/scheduler/run-reminders');
      setSchedulerMessage(res.data.message);
      await fetchDashboardData();
    } catch (err: any) {
      setSchedulerMessage(err.response?.data?.detail || 'Failed to trigger reminder job.');
    } finally {
      setIsRunningScheduler(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      {/* Dashboard Top Bar */}
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-primary-soft text-primary px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-secondary" />
                Live CRM & Editorial Pipeline
              </div>
              <h1 className="text-3xl font-heading font-extrabold text-text-dark">
                Writathon Lead Management System
              </h1>
              <p className="text-sm text-text-muted mt-1">
                Real-time journey tracking from Interest Registration to Anthology Publication.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunReminders}
                disabled={isRunningScheduler}
                className="btn-secondary text-sm py-2 px-4 shadow-xs"
                title="Executes scheduled background reminder checks"
              >
                <Bell className={`w-4 h-4 text-rust ${isRunningScheduler ? 'animate-bounce' : ''}`} />
                {isRunningScheduler ? 'Running Job...' : 'Run Reminder Scheduler'}
              </button>

              <button
                onClick={fetchDashboardData}
                className="p-2.5 rounded-full bg-white border border-app-border text-gray-500 hover:text-black transition hover:rotate-180"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {schedulerMessage && (
            <div className="mt-4 p-3 bg-white rounded-xl border border-primary/30 text-primary text-xs font-medium flex items-center justify-between shadow-xs">
              <span>{schedulerMessage}</span>
              <button onClick={() => setSchedulerMessage('')} className="text-gray-400 hover:text-black">✕</button>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Journey Stages Cards Grid (Section 28 Requirements) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-dark">
              Pipeline Stages & Funnel Counts
            </h2>
            <span className="text-xs text-text-muted">Direct from Database (Not hardcoded)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Leads */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Leads</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-text-dark">
                {stats?.total_leads ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">All registrations</div>
            </div>

            {/* Contacted */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo">Contacted</span>
                <Mail className="w-4 h-4 text-indigo" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-indigo">
                {stats?.contacted ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Confirmed via email</div>
            </div>

            {/* Reminder Sent */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rust">Reminded</span>
                <Bell className="w-4 h-4 text-rust" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-rust">
                {stats?.reminder_sent ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Awaiting story</div>
            </div>

            {/* Stories Submitted */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Submitted</span>
                <Upload className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-blue-600">
                {stats?.stories_submitted ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Reminders stopped</div>
            </div>

            {/* Under Review */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">In Review</span>
                <ShieldCheck className="w-4 h-4 text-secondary" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-secondary">
                {stats?.under_review ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Editorial panel</div>
            </div>

            {/* Eligible */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Eligible</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-emerald-600">
                {stats?.eligible ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Quality approved</div>
            </div>

            {/* Not Eligible */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Not Eligible</span>
                <span className="text-xs font-bold text-rose-500">✕</span>
              </div>
              <div className="text-2xl font-heading font-extrabold text-rose-600">
                {stats?.not_eligible ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Feedback dispatched</div>
            </div>

            {/* Payment Pending */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Payment Due</span>
                <CreditCard className="w-4 h-4 text-amber-700" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-amber-700">
                {stats?.payment_pending ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Links dispatched</div>
            </div>

            {/* Paid */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Paid</span>
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-teal-700">
                {stats?.paid ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Webhook verified</div>
            </div>

            {/* Completed */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Completed</span>
                <Sparkles className="w-4 h-4 text-purple-700" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-purple-700">
                {stats?.completed ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Ready for print</div>
            </div>

            {/* Published */}
            <div className="bg-white rounded-2xl p-4 shadow-subtle border border-app-border">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">Published</span>
                <BookOpen className="w-4 h-4 text-purple-900" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-purple-900">
                {stats?.published ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Live in volume</div>
            </div>

            {/* Revenue */}
            <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl p-4 text-white shadow-elevated">
              <div className="flex items-center justify-between text-white/80 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Revenue</span>
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <div className="text-xl font-heading font-extrabold">
                ₹{stats?.revenue_total?.toLocaleString() ?? 0}
              </div>
              <div className="text-[10px] text-white/80 mt-1">From paid fees</div>
            </div>
          </div>
        </div>

        {/* Quick Links / Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/admin/leads"
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                All Leads Directory
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Filter, search, and manage candidate leads</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            to="/admin/templates"
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                Email Templates
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Manage automated email copy & previews</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            to="/admin/communications"
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                Communication Audit Log
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Audit every dispatched email and resend</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            to="/admin/submissions"
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                Story Submissions
              </h3>
              <p className="text-xs text-text-muted mt-0.5">All submitted stories by Writathon and status</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            to="/admin/students"
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                Students
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Each child once, with history across Writathons</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            to="/admin/writathons"
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                Writathon Events
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Create events and open or close registrations</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          {user?.role === 'ADMIN' && <Link
            to="/admin/team"
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                Team & Access
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Add staff, roles and access</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>}
        </div>

        {/* Per-Writathon report */}
        {stats && stats.by_writathon.length > 0 && (
          <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border overflow-x-auto">
            <h2 className="text-lg font-heading font-bold text-text-dark mb-1">Registrations & Submissions by Writathon</h2>
            <p className="text-xs text-text-muted mb-4">
              {stats.total_students} unique students · {stats.unassigned_leads} leads without an owner
            </p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Writathon</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Registrations</th>
                  <th className="py-2.5 px-3 text-right">Submitted</th>
                  <th className="py-2.5 px-3 text-right">Not submitted</th>
                  <th className="py-2.5 px-3 text-right">Submission rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.by_writathon.map((w) => (
                  <tr key={w.writathon_id}>
                    <td className="py-2.5 px-3 font-bold text-text-dark">{w.writathon_name}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={w.status} /></td>
                    <td className="py-2.5 px-3 text-right">{w.registrations}</td>
                    <td className="py-2.5 px-3 text-right">{w.submissions}</td>
                    <td className="py-2.5 px-3 text-right">{w.not_submitted}</td>
                    <td className="py-2.5 px-3 text-right">
                      {w.registrations ? Math.round((w.submissions / w.registrations) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent Leads Table */}
        <div className="bg-white rounded-card p-6 shadow-subtle border border-app-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-lg text-text-dark">
                Recent Lead Pipeline Activity
              </h3>
              <p className="text-xs text-text-muted">Click any lead to view full review and communication history</p>
            </div>
            <Link to="/admin/leads" className="btn-secondary text-xs py-1.5 px-3.5">
              View All Leads ({stats?.total_leads ?? 0})
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Lead ID</th>
                  <th className="py-3 px-3">Child Name</th>
                  <th className="py-3 px-3">Parent Details</th>
                  <th className="py-3 px-3">Grade & School</th>
                  <th className="py-3 px-3">Current Status</th>
                  <th className="py-3 px-3">Registered</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-primary-soft/30 transition-colors">
                    <td className="py-3 px-3 font-bold text-primary">
                      {lead.lead_id}
                    </td>
                    <td className="py-3 px-3 font-semibold text-text-dark">
                      {lead.child_name} <span className="text-gray-400 font-normal">({lead.age_group ?? lead.child_age} yrs)</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-text-dark">{lead.parent_name}</div>
                      <div className="text-[11px] text-text-muted">{lead.parent_email}</div>
                    </td>
                    <td className="py-3 px-3 text-text-muted">
                      <div>{lead.grade}</div>
                      <div className="text-[11px] truncate max-w-[150px]">{lead.school}</div>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="py-3 px-3 text-text-muted whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/admin/leads/${lead.id}`}
                        className="btn-primary text-[11px] py-1 px-3"
                      >
                        Manage Lead
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
