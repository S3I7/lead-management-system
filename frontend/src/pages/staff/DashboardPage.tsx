import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { api, DashboardStats, Lead } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, Mail, Bell, Upload, ShieldCheck, Award, 
  CreditCard, Sparkles, BookOpen, RefreshCw, ArrowUpRight, CheckCircle2,
  BarChart3, ChevronRight, Clock, TrendingUp
} from 'lucide-react';

interface StatCardProps {
  to: string;
  'aria-label': string;
  isRevenue?: boolean;
  children: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ to, 'aria-label': ariaLabel, isRevenue, children }) => {
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
      boxShadow: isRevenue
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
        isRevenue
          ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-elevated focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary'
          : 'bg-white shadow-subtle border border-app-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
      }`}
    >
      {children}
    </Link>
  );
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [schedulerMessage, setSchedulerMessage] = useState('');
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const cardsGridRef = useRef<HTMLDivElement>(null);
  const writathonSectionRef = useRef<HTMLDivElement>(null);

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

  // GSAP Entrance animation with React Strict Mode cleanup and reduced-motion check
  useEffect(() => {
    if (!cardsGridRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.stat-card',
        {
          opacity: 0,
          y: 16,
        },
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
  }, []);

  // GSAP animation for Writathon Registrations & Submissions section
  useEffect(() => {
    if (!writathonSectionRef.current || !stats?.by_writathon?.length) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      const fills = writathonSectionRef.current.querySelectorAll<HTMLElement>('.writathon-progress-fill');
      fills.forEach((fill) => {
        const rate = fill.getAttribute('data-rate') || '0';
        fill.style.width = `${rate}%`;
      });
      return;
    }

    const ctx = gsap.context(() => {
      // 1. Staggered row entrance
      gsap.fromTo(
        '.writathon-row',
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        }
      );

      // 2. Smooth animated progress bar fill
      const fills = writathonSectionRef.current?.querySelectorAll<HTMLElement>('.writathon-progress-fill');
      if (fills) {
        fills.forEach((fill, idx) => {
          const rate = fill.getAttribute('data-rate') || '0';
          gsap.fromTo(
            fill,
            { width: '0%' },
            {
              width: `${rate}%`,
              duration: 1.15,
              delay: 0.15 + idx * 0.08,
              ease: 'power3.out',
            }
          );
        });
      }

      // 3. Header badge chips pop-in
      gsap.fromTo(
        '.writathon-pill',
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.35,
          stagger: 0.06,
          ease: 'back.out(1.5)',
        }
      );
    }, writathonSectionRef);

    return () => ctx.revert();
  }, [stats?.by_writathon]);

  const handleWritathonRowEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    gsap.to(e.currentTarget, {
      x: 4,
      boxShadow: '0 4px 14px -2px rgba(107, 70, 193, 0.08)',
      backgroundColor: '#F8FAFC',
      duration: 0.22,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  const handleWritathonRowLeave = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    gsap.to(e.currentTarget, {
      x: 0,
      boxShadow: 'none',
      backgroundColor: 'transparent',
      duration: 0.22,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  const handleWritathonBadgeEnter = (e: React.MouseEvent<HTMLElement>) => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    gsap.to(e.currentTarget, {
      scale: 1.08,
      duration: 0.18,
      ease: 'back.out(2)',
      overwrite: 'auto',
    });
  };

  const handleWritathonBadgeLeave = (e: React.MouseEvent<HTMLElement>) => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    gsap.to(e.currentTarget, {
      scale: 1,
      duration: 0.18,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

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
                Live CRM & Editorial Pipeline · Administrator Overview
              </div>
              <h1 className="text-3xl font-heading font-extrabold text-text-dark">
                Writathon Admin Dashboard
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

          <div ref={cardsGridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Total Leads */}
            <StatCard
              to="/admin/leads"
              aria-label={`Total Leads: ${stats?.total_leads ?? 0} all registrations. View all leads directory`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Leads</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-text-dark">
                {stats?.total_leads ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">All registrations</div>
            </StatCard>

            {/* 2. Contacted */}
            <StatCard
              to="/admin/leads?status_filter=CONTACTED"
              aria-label={`Contacted: ${stats?.contacted ?? 0} leads confirmed via email. View contacted leads`}
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
              to="/admin/leads?status_filter=REMINDER_SENT"
              aria-label={`Reminded: ${stats?.reminder_sent ?? 0} leads awaiting story. View reminded leads`}
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
              to="/admin/submissions?status_filter=SUBMITTED"
              aria-label={`Submitted: ${stats?.stories_submitted ?? 0} stories submitted. View story submissions directory`}
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

            {/* 5. Under Review */}
            <StatCard
              to="/admin/submissions?status_filter=UNDER_REVIEW"
              aria-label={`In Review: ${stats?.under_review ?? 0} stories awaiting editorial decisions. View submissions in review`}
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
              to="/admin/submissions?status_filter=ELIGIBLE"
              aria-label={`Eligible: ${stats?.eligible ?? 0} stories approved as eligible. View eligible submissions`}
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
              to="/admin/submissions?status_filter=NOT_ELIGIBLE"
              aria-label={`Not Eligible: ${stats?.not_eligible ?? 0} stories marked not eligible. View not eligible submissions`}
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
              to="/admin/leads?status_filter=PAYMENT_PENDING"
              aria-label={`Payment Due: ${stats?.payment_pending ?? 0} eligible stories awaiting payment. View payment pending leads`}
            >
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Payment Due</span>
                <CreditCard className="w-4 h-4 text-amber-700" />
              </div>
              <div className="text-2xl font-heading font-extrabold text-amber-700">
                {stats?.payment_pending ?? 0}
              </div>
              <div className="text-[10px] text-text-muted mt-1">Links dispatched</div>
            </StatCard>

            {/* 9. Paid */}
            <StatCard
              to="/admin/leads?payment_status=PAID"
              aria-label={`Paid: ${stats?.paid ?? 0} payments verified successfully. View verified paid leads`}
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
              to="/admin/leads?status_filter=COMPLETED"
              aria-label={`Completed: ${stats?.completed ?? 0} stories ready for print. View completed records`}
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
              aria-label={`Published: ${stats?.published ?? 0} stories published. View published submissions`}
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

            {/* 12. Revenue */}
            <StatCard
              to="/admin/leads?payment_status=PAID"
              isRevenue
              aria-label={`Revenue: ₹${stats?.revenue_total?.toLocaleString() ?? 0} collected from paid fees. View paid registrations`}
            >
              <div className="flex items-center justify-between text-white/80 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Revenue</span>
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <div className="text-xl font-heading font-extrabold">
                ₹{stats?.revenue_total?.toLocaleString() ?? 0}
              </div>
              <div className="text-[10px] text-white/80 mt-1">From paid fees</div>
            </StatCard>
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
          <div 
            ref={writathonSectionRef}
            className="bg-white rounded-card p-6 shadow-subtle border border-app-border relative overflow-hidden"
          >
            {/* Ambient decorative background glow */}
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-gradient-to-bl from-primary/10 via-secondary/5 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-heading font-bold text-text-dark tracking-tight">
                      Registrations & Submissions by Writathon
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      Live Overview
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="writathon-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/70 shadow-xs">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span><strong className="font-semibold text-text-dark">{stats.total_students}</strong> unique students</span>
                    </span>
                    {stats.unassigned_leads > 0 ? (
                      <Link
                        to="/admin/leads"
                        className="writathon-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 transition-colors group shadow-xs"
                        title="View leads without assigned owner"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span><strong className="font-bold text-amber-900">{stats.unassigned_leads}</strong> leads without an owner</span>
                        <ArrowUpRight className="w-3 h-3 text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </Link>
                    ) : (
                      <span className="writathon-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        All leads assigned
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Link
                  to="/admin/writathons"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-white bg-primary-soft hover:bg-primary px-3.5 py-2 rounded-xl border border-primary/20 hover:border-primary transition-all duration-200 group shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Manage Events</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto relative z-10 -mx-6 px-6">
              <table className="w-full text-left text-xs border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3.5 font-semibold">Writathon</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Registrations</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Submitted</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Not Submitted</th>
                    <th className="py-2.5 px-4 font-semibold min-w-[200px]">Submission Rate</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_writathon.map((w) => {
                    const rate = w.registrations ? Math.round((w.submissions / w.registrations) * 100) : 0;
                    return (
                      <tr 
                        key={w.writathon_id}
                        onMouseEnter={handleWritathonRowEnter}
                        onMouseLeave={handleWritathonRowLeave}
                        className="writathon-row bg-slate-50/60 border border-slate-200/60 rounded-xl transition-all duration-200 group cursor-default"
                      >
                        {/* Event Name */}
                        <td className="rounded-l-xl py-3 px-3.5 border-y border-l border-slate-200/60">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/15 group-hover:bg-primary group-hover:text-white transition-colors duration-200 shadow-2xs">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-heading font-bold text-text-dark text-sm block group-hover:text-primary transition-colors">
                                {w.writathon_name}
                              </span>
                              <span className="text-[10px] text-text-muted">
                                Event ID #{w.writathon_id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 border-y border-slate-200/60 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {w.status === 'ACTIVE' && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                            )}
                            <StatusBadge status={w.status} />
                          </div>
                        </td>

                        {/* Registrations */}
                        <td className="py-3 px-3 text-right border-y border-slate-200/60">
                          <Link
                            to={`/admin/leads?writathon_id=${w.writathon_id}`}
                            onMouseEnter={handleWritathonBadgeEnter}
                            onMouseLeave={handleWritathonBadgeLeave}
                            className="writathon-stat-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/90 text-slate-800 font-mono font-bold text-xs border border-slate-200/80 transition-shadow shadow-2xs"
                            title="View all registered leads for this event"
                          >
                            <Users className="w-3 h-3 text-slate-500" />
                            {w.registrations}
                          </Link>
                        </td>

                        {/* Submitted */}
                        <td className="py-3 px-3 text-right border-y border-slate-200/60">
                          <Link
                            to={`/admin/submissions?writathon_id=${w.writathon_id}`}
                            onMouseEnter={handleWritathonBadgeEnter}
                            onMouseLeave={handleWritathonBadgeLeave}
                            className="writathon-stat-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-mono font-bold text-xs border border-emerald-200/80 transition-shadow shadow-2xs"
                            title="View submitted stories for this event"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {w.submissions}
                          </Link>
                        </td>

                        {/* Not Submitted */}
                        <td className="py-3 px-3 text-right border-y border-slate-200/60">
                          <Link
                            to={`/admin/leads?writathon_id=${w.writathon_id}&status=REGISTERED`}
                            onMouseEnter={handleWritathonBadgeEnter}
                            onMouseLeave={handleWritathonBadgeLeave}
                            className="writathon-stat-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-mono font-bold text-xs border border-amber-200/80 transition-shadow shadow-2xs"
                            title="View pending registered leads without story submission"
                          >
                            <Clock className="w-3 h-3 text-amber-600" />
                            {w.not_submitted}
                          </Link>
                        </td>

                        {/* Submission Rate & GSAP Animated Progress Bar */}
                        <td className="py-3 px-4 min-w-[200px] border-y border-slate-200/60">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-heading font-extrabold text-xs text-text-dark font-mono flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-primary" />
                                {rate}%
                              </span>
                              <span className="text-[11px] text-text-muted font-medium font-mono">
                                {w.submissions} / {w.registrations}
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                              <div
                                data-rate={rate}
                                className={`writathon-progress-fill h-full rounded-full transition-all shadow-xs ${
                                  rate >= 75
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                    : rate >= 40
                                    ? 'bg-gradient-to-r from-primary to-indigo'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-400'
                                }`}
                                style={{ width: '0%' }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Action Link */}
                        <td className="rounded-r-xl py-3 px-3 text-right border-y border-r border-slate-200/60 whitespace-nowrap">
                          <Link
                            to={`/admin/leads?writathon_id=${w.writathon_id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-light px-2.5 py-1.5 rounded-lg hover:bg-primary-soft transition-colors group-hover:translate-x-0.5 transition-transform"
                            title="View leads for this event"
                          >
                            <span>Leads</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
