import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { api, StaffDashboardStats, Lead } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, Mail, Bell, Upload, ShieldCheck, Award, 
  CreditCard, Sparkles, BookOpen, RefreshCw, ArrowUpRight, CheckCircle2,
  ListTodo
} from 'lucide-react';

interface StatCardProps {
  to: string;
  'aria-label': string;
  isGradient?: boolean;
  children: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ to, 'aria-label': ariaLabel, isGradient, children }) => {
  const cardRef = useRef<HTMLAnchorElement>(null);

  const handleMouseEnter = () => {
    if (!cardRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(cardRef.current, {
      y: prefersReduced ? 0 : -4,
      scale: prefersReduced ? 1 : 1.02,
      duration: 0.25,
      ease: 'power2.out',
      overwrite: 'auto',
      boxShadow: isGradient
        ? '0 16px 28px -6px rgba(107, 33, 168, 0.35)'
        : '0 12px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04)',
    });
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    gsap.to(cardRef.current, {
      y: 0,
      scale: 1,
      duration: 0.25,
      ease: 'power2.out',
      overwrite: 'auto',
      clearProps: 'boxShadow',
    });
  };

  const handleMouseDown = () => {
    if (!cardRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(cardRef.current, {
      scale: prefersReduced ? 1 : 0.985,
      duration: 0.1,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  const handleMouseUp = () => {
    if (!cardRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(cardRef.current, {
      scale: prefersReduced ? 1 : 1.02,
      duration: 0.15,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  return (
    <Link
      ref={cardRef}
      to={to}
      aria-label={ariaLabel}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`stat-card block rounded-2xl p-4 no-underline cursor-pointer select-none transition-shadow focus:outline-none ${
        isGradient
          ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-elevated focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary'
          : 'bg-white shadow-subtle border border-app-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
      }`}
    >
      {children}
    </Link>
  );
};

export const StaffDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<StaffDashboardStats | null>(null);
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cardsGridRef = useRef<HTMLDivElement>(null);

  const fetchStaffData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [statsResult, leadsResult] = await Promise.allSettled([
        api.get<StaffDashboardStats>('/dashboard/staff-stats'),
        api.get<Lead[]>(`/leads?limit=8&owner_id=${user.id}`),
      ]);
      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data);
      } else {
        console.error('Failed to fetch staff stats:', statsResult.reason);
      }
      if (leadsResult.status === 'fulfilled') {
        setMyLeads(leadsResult.value.data);
      } else {
        console.error('Failed to fetch staff leads:', leadsResult.reason);
      }
    } catch (err) {
      console.error('Failed to fetch staff dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStaffData();
    }
  }, [user]);

  // GSAP Entrance animation with cleanup and reduced-motion check
  useEffect(() => {
    if (!cardsGridRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.stat-card',
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.04,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        }
      );
    }, cardsGridRef);

    return () => ctx.revert();
  }, [isLoading]);

  const ownerParam = user ? `&owner_id=${user.id}` : '';

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      {/* Staff Dashboard Top Bar */}
      <section className="py-8 bg-hero-gradient-1 border-b border-app-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-secondary-soft text-secondary px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider mb-2">
                <ListTodo className="w-3.5 h-3.5 text-secondary" />
                Staff Operational Workspace
              </div>
              <h1 className="text-3xl font-heading font-extrabold text-text-dark">
                Editorial & CRM Pipeline Workspace
              </h1>
              <p className="text-sm text-text-muted mt-1">
                Personalized queue for {user?.full_name || 'Staff'}: assigned leads and workflow tasks.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchStaffData}
                aria-label="Refresh dashboard data"
                className="p-2.5 rounded-full bg-white border border-app-border text-gray-500 hover:text-black transition hover:rotate-180"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Pipeline Stages Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-dark">
              My Assigned Pipeline & Review Status
            </h2>
            <span className="text-xs text-text-muted">Assigned to {user?.full_name}</span>
          </div>

          <div ref={cardsGridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. My Leads */}
            <StatCard
              to={`/admin/leads?owner_id=${user?.id || 0}`}
              aria-label={`My Leads: ${stats?.assigned_leads ?? 0} assigned registrations. View my leads`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">My Leads</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-text-dark">
                {stats?.assigned_leads ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Assigned to you</div>
            </StatCard>

            {/* 2. Contacted */}
            <StatCard
              to={`/admin/leads?status_filter=CONTACTED${ownerParam}`}
              aria-label={`Contacted: ${stats?.contacted ?? 0} leads confirmed via email`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo">Contacted</span>
                <Mail className="w-4 h-4 text-indigo" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-indigo">
                {stats?.contacted ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Confirmed via email</div>
            </StatCard>

            {/* 3. Reminder Sent */}
            <StatCard
              to={`/admin/leads?status_filter=REMINDER_SENT${ownerParam}`}
              aria-label={`Reminded: ${stats?.reminder_sent ?? 0} leads awaiting story`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rust">Reminded</span>
                <Bell className="w-4 h-4 text-rust" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-rust">
                {stats?.reminder_sent ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Awaiting story</div>
            </StatCard>

            {/* 4. Stories Submitted */}
            <StatCard
              to={`/admin/leads?status_filter=STORY_SUBMITTED${ownerParam}`}
              aria-label={`Submitted: ${stats?.stories_submitted ?? 0} assigned stories submitted`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Submitted</span>
                <Upload className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-blue-600">
                {stats?.stories_submitted ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Reminders stopped</div>
            </StatCard>

            {/* 5. In Review */}
            <StatCard
              to={`/admin/leads?status_filter=UNDER_REVIEW${ownerParam}`}
              aria-label={`In Review: ${stats?.under_review ?? 0} assigned stories in review`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">In Review</span>
                <ShieldCheck className="w-4 h-4 text-secondary" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-secondary">
                {stats?.under_review ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Editorial panel</div>
            </StatCard>

            {/* 6. Eligible */}
            <StatCard
              to={`/admin/leads?status_filter=ELIGIBLE${ownerParam}`}
              aria-label={`Eligible: ${stats?.eligible ?? 0} stories approved as eligible`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Eligible</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-emerald-600">
                {stats?.eligible ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Quality approved</div>
            </StatCard>

            {/* 7. Not Eligible */}
            <StatCard
              to={`/admin/leads?status_filter=NOT_ELIGIBLE${ownerParam}`}
              aria-label={`Not Eligible: ${stats?.not_eligible ?? 0} stories marked not eligible`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Not Eligible</span>
                <span className="text-xs font-bold text-rose-500">✕</span>
              </div>
              <div className="text-2xl font-heading font-extrabold text-rose-600">
                {stats?.not_eligible ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Feedback dispatched</div>
            </StatCard>

            {/* 8. Payment Pending */}
            <StatCard
              to={`/admin/leads?status_filter=PAYMENT_PENDING${ownerParam}`}
              aria-label={`Payment Due: ${stats?.payment_pending ?? 0} assigned stories awaiting payment`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Payment Due</span>
                <CreditCard className="w-4 h-4 text-amber-700" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-amber-700">
                {stats?.payment_pending ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Follow-up active</div>
            </StatCard>

            {/* 9. Paid */}
            <StatCard
              to={`/admin/leads?payment_status=PAID${ownerParam}`}
              aria-label={`Paid: ${stats?.paid ?? 0} verified payments`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Paid</span>
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-teal-700">
                {stats?.paid ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Webhook verified</div>
            </StatCard>

            {/* 10. Completed */}
            <StatCard
              to={`/admin/leads?status_filter=COMPLETED${ownerParam}`}
              aria-label={`Completed: ${stats?.completed ?? 0} stories ready for print`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Completed</span>
                <Sparkles className="w-4 h-4 text-purple-700" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-purple-700">
                {stats?.completed ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Ready for print</div>
            </StatCard>

            {/* 11. Published */}
            <StatCard
              to="/admin/submissions?status_filter=PUBLISHED"
              aria-label={`Published: ${stats?.published ?? 0} stories published`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">Published</span>
                <BookOpen className="w-4 h-4 text-purple-900" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-purple-900">
                {stats?.published ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Live in volume</div>
            </StatCard>

          </div>
        </div>

        {/* Quick Operational Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to={`/admin/leads?owner_id=${user?.id || 0}`}
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                My Assigned Leads
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Filter and manage leads assigned to your queue</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <Link
            to="/admin/communications"
            className="p-5 bg-white rounded-card shadow-subtle border border-app-border hover:border-primary transition group flex items-center justify-between"
          >
            <div>
              <h3 className="font-heading font-bold text-text-dark text-base group-hover:text-primary transition-colors">
                Communication History
              </h3>
              <p className="text-xs text-text-muted mt-0.5">View automated reminder logs and delivery states</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {/* My Assigned Leads Table */}
        <div className="bg-white rounded-card shadow-subtle border border-app-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-heading font-bold text-text-dark">
                Recent Leads in My Queue
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Showing candidates assigned to you for contact, review, and follow-up.
              </p>
            </div>
            <Link to={`/admin/leads?owner_id=${user?.id || 0}`} className="text-xs font-semibold text-primary hover:underline">
              View all ({stats?.assigned_leads ?? 0}) →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Lead ID</th>
                  <th className="py-3 px-3">Child & Parent</th>
                  <th className="py-3 px-3">Writathon</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Story</th>
                  <th className="py-3 px-3 text-right">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {myLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-primary-soft/20 transition-colors">
                    <td className="py-3 px-3">
                      <Link to={`/admin/leads/${lead.id}`} className="font-bold text-primary hover:underline">
                        {lead.lead_id}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-text-dark">{lead.child_name}</div>
                      <div className="text-[11px] text-text-muted">{lead.parent_name} · {lead.city || 'India'}</div>
                    </td>
                    <td className="py-3 px-3 text-text-muted">{lead.writathon_name}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        lead.submission_status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {lead.submission_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-text-muted">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {myLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-text-muted">
                      No leads currently assigned to you. Unassigned leads can be picked up in the Leads Directory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
