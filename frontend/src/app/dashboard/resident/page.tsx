'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Wrench, CreditCard, CalendarRange,
  QrCode, BarChart3, Folder, Ticket, Clock, ChevronRight,
  Package, AlertTriangle, CheckCircle2, Home, Users, HelpCircle,
} from 'lucide-react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { StatTile, StatTileGrid } from '@/components/ui/StatTile';
import { Panel, CountPill, SectionLabel, PanelEmpty } from '@/components/ui/Panel';
import { useResidentShell } from '@/components/dashboard/resident-shell';

// ── Types ─────────────────────────────────────────────────────────────
interface DashboardData {
  unreadNotices: number;
  openTickets: number;
  pendingInvoices: { count: number; overdue: boolean };
  pendingVisitors: number;
  activePolls: number;
  recentActivity: Array<{ type: string; title: string; time: string; status?: string }>;
  onDutyStaff: Array<{ name: string; role: string }>;
}

// ── Helpers ──────────────────────────────────────────────────────────
function today(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface AttentionItem {
  icon: React.ElementType;
  label: string;
  detail: string;
  action: string;
  href: string;
  urgent: boolean;
}

// ── Resident Dashboard ─────────────────────────────────────────────────
export default function ResidentDashboard() {
  const router = useRouter();
  const { user } = useResidentShell();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData>({
    unreadNotices: 0, openTickets: 0, pendingInvoices: { count: 0, overdue: false },
    pendingVisitors: 0, activePolls: 0, recentActivity: [],
    onDutyStaff: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [notices, tickets, invoices, visitors, polls, onDuty] = await Promise.all([
          apiGet<any[]>('/api/v1/notices').catch(() => []),
          apiGet<any[]>('/api/v1/tickets').catch(() => []),
          apiGet<any[]>('/api/v1/invoices').catch(() => []),
          apiGet<any[]>('/api/v1/visitor-passes').catch(() => []),
          apiGet<any[]>('/api/v1/polls').catch(() => []),
          apiGet<any[]>('/api/v1/staff/on-duty').catch(() => []),
        ]);
        if (cancelled) return;

        const unreadNotices = notices.filter((n: any) => !n.hasRead).length;
        const openTickets = tickets.filter((t: any) =>
          ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)
        ).length;
        const pendingInvoices = invoices.filter((i: any) => i.status === 'PENDING' || i.status === 'OVERDUE');
        const pendingVisitors = visitors.filter((v: any) => v.status === 'PENDING').length;
        const activePolls = polls.filter((p: any) => p.status === 'ACTIVE').length;

        // Build recent activity
        const allActivity: Array<{ type: string; title: string; time: string; status?: string }> = [];
        tickets.slice(0, 5).forEach((t: any) => allActivity.push({ type: 'ticket', title: t.title, time: t.updatedAt || t.createdAt, status: t.status }));
        notices.slice(0, 3).forEach((n: any) => allActivity.push({ type: 'notice', title: n.title, time: n.createdAt }));
        invoices.filter((i: any) => i.status === 'PAID').slice(0, 3).forEach((i: any) => allActivity.push({ type: 'payment', title: `Payment for ${i.month || 'dues'}`, time: i.updatedAt || i.createdAt }));
        allActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        const recentActivity = allActivity.slice(0, 10);

        setDashboard({
          unreadNotices,
          openTickets,
          pendingInvoices: { count: pendingInvoices.length, overdue: pendingInvoices.some((i: any) => i.status === 'OVERDUE') },
          pendingVisitors,
          activePolls,
          recentActivity,
          onDutyStaff: (onDuty || []).map((s: any) => ({ name: s.name, role: s.role })),
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.push('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) return <PageSkeleton width="max-w-6xl" />;

  const firstName = user?.user.name?.split(' ')[0] || 'there';
  const membership = user?.memberships[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // What the resident actually has to act on, in priority order.
  const attentionCandidates: Array<AttentionItem | false> = [
    dashboard.pendingInvoices.count > 0 && {
      icon: CreditCard,
      label: dashboard.pendingInvoices.overdue
        ? `${dashboard.pendingInvoices.count} overdue due${dashboard.pendingInvoices.count > 1 ? 's' : ''}`
        : `${dashboard.pendingInvoices.count} pending due${dashboard.pendingInvoices.count > 1 ? 's' : ''}`,
      detail: dashboard.pendingInvoices.overdue
        ? 'Past the due date. Settle them to avoid late fees.'
        : 'Pay before the due date to keep your account clear.',
      href: '/dashboard/resident/invoices',
      action: 'Pay now',
      urgent: dashboard.pendingInvoices.overdue,
    },
    dashboard.openTickets > 0 && {
      icon: Ticket,
      label: `${dashboard.openTickets} open ticket${dashboard.openTickets > 1 ? 's' : ''}`,
      detail: 'Still with the maintenance team. Track progress or add details.',
      href: '/dashboard/resident/tickets',
      action: 'Track',
      urgent: false,
    },
    dashboard.pendingVisitors > 0 && {
      icon: QrCode,
      label: `${dashboard.pendingVisitors} visitor pass${dashboard.pendingVisitors > 1 ? 'es' : ''} awaiting approval`,
      detail: 'Approve or decline so the gate knows who to expect.',
      href: '/dashboard/resident/visitors',
      action: 'Review',
      urgent: false,
    },
    dashboard.unreadNotices > 0 && {
      icon: FileText,
      label: `${dashboard.unreadNotices} unread notice${dashboard.unreadNotices > 1 ? 's' : ''}`,
      detail: 'Announcements from your committee you have not opened yet.',
      href: '/dashboard/resident/notices',
      action: 'Read',
      urgent: false,
    },
  ];
  const attentionItems = attentionCandidates.filter((x): x is AttentionItem => Boolean(x));

  const activityIconMap: Record<string, React.ElementType> = {
    ticket: Wrench,
    notice: FileText,
    payment: CreditCard,
  };

  const statusVariant = (s?: string) => {
    if (!s) return 'neutral' as const;
    if (s === 'OPEN' || s === 'ASSIGNED') return 'warning' as const;
    if (s === 'IN_PROGRESS') return 'info' as const;
    if (s === 'RESOLVED' || s === 'CLOSED' || s === 'PAID') return 'success' as const;
    return 'neutral' as const;
  };

  const quickActions: Array<{ icon: React.ElementType; label: string; href: string; badge?: number; urgent?: boolean }> = [
    { icon: Wrench, label: 'Raise ticket', href: '/dashboard/resident/tickets', badge: dashboard.openTickets },
    { icon: CreditCard, label: 'Pay dues', href: '/dashboard/resident/invoices', badge: dashboard.pendingInvoices.count, urgent: dashboard.pendingInvoices.overdue },
    { icon: CalendarRange, label: 'Book amenity', href: '/dashboard/resident/amenities' },
    { icon: QrCode, label: 'Visitor pass', href: '/dashboard/resident/visitors', badge: dashboard.pendingVisitors },
    { icon: FileText, label: 'Notices', href: '/dashboard/resident/notices', badge: dashboard.unreadNotices },
    { icon: BarChart3, label: 'Vote', href: '/dashboard/resident/polls', badge: dashboard.activePolls },
    { icon: Folder, label: 'Documents', href: '/dashboard/resident/documents' },
    { icon: Package, label: 'Packages', href: '/dashboard/resident/parcels' },
  ];

  return (
    <div className="space-y-8">
      {/* ── Greeting ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up">
        <div className="flex items-center gap-4">
          <span className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
            <Home className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              {membership?.societyName || 'Your community'}
            </p>
            <h1 className="mt-1 text-display-sm font-display text-gray-900">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-body-sm text-gray-500">
              {attentionItems.length > 0
                ? `${attentionItems.length} thing${attentionItems.length > 1 ? 's' : ''} need${attentionItems.length === 1 ? 's' : ''} your attention today.`
                : 'Everything is up to date. Nothing needs you right now.'}
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CalendarRange className="h-4.5 w-4.5 flex-shrink-0 text-accent-500" aria-hidden="true" />
          <div>
            <p className="text-body-sm font-semibold text-gray-900">{today()}</p>
            <p className="text-caption-xs text-gray-500">Your home, at a glance</p>
          </div>
        </div>
      </header>

      {/* ── Stat tiles ───────────────────────────────────────────── */}
      <StatTileGrid className="animate-fade-in-up" style={{ animationDelay: '0.04s' }}>
        <StatTile
          icon={Ticket}
          label="Open tickets"
          value={dashboard.openTickets}
          hint={dashboard.openTickets === 0 ? 'Nothing open' : 'Being worked on'}
        />
        <StatTile
          icon={CreditCard}
          label="Pending dues"
          value={dashboard.pendingInvoices.count}
          hint={dashboard.pendingInvoices.overdue ? 'Overdue now' : dashboard.pendingInvoices.count === 0 ? 'All settled' : 'Due soon'}
          tone={dashboard.pendingInvoices.overdue ? 'danger' : 'accent'}
        />
        <StatTile
          icon={FileText}
          label="Unread notices"
          value={dashboard.unreadNotices}
          hint={dashboard.unreadNotices === 0 ? 'All caught up' : 'From your committee'}
        />
        <StatTile
          icon={BarChart3}
          label="Open polls"
          value={dashboard.activePolls}
          hint={dashboard.activePolls === 0 ? 'No open polls' : 'Waiting for your vote'}
        />
      </StatTileGrid>

      {/* ── Attention + SOS ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5 animate-fade-in-up" style={{ animationDelay: '0.08s' }}>
        <Panel
          icon={AlertTriangle}
          title="Needs your attention"
          hint={attentionItems.length > 0 ? 'Tap a row to act on it' : 'Nothing waiting on you'}
          meta={attentionItems.length > 0 ? <CountPill>{attentionItems.length}</CountPill> : undefined}
          className="lg:col-span-3"
        >
          {attentionItems.length === 0 ? (
            <PanelEmpty
              icon={CheckCircle2}
              title="You are all clear"
              description="No dues, tickets or passes are waiting on you. We will flag anything new here."
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {attentionItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => router.push(item.href)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                >
                  <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 transition-transform duration-200 group-hover:scale-105">
                    <item.icon className="h-4.5 w-4.5" />
                    {item.urgent && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-status-danger ring-2 ring-white" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold text-gray-900">{item.label}</span>
                    <span className="mt-0.5 block truncate text-caption-xs text-gray-500">{item.detail}</span>
                  </span>
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-200/70 transition-all group-hover:bg-accent-600 group-hover:text-white group-hover:ring-accent-600">
                    {item.action}
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <div className="lg:col-span-2">
          <SOSButton unitId={membership?.unitId || ''} onTriggered={() => {}} />
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────── */}
      <section className="animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
        <SectionLabel
          right={
            <span className="text-caption-xs text-gray-400">
              {dashboard.openTickets + dashboard.pendingInvoices.count + dashboard.pendingVisitors + dashboard.unreadNotices} open
            </span>
          }
        >
          Quick actions
        </SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-gray-200/80 bg-white p-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_10px_26px_-14px_rgba(37,99,235,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              {action.badge && action.badge > 0 ? (
                <span
                  className={`absolute right-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white ${
                    action.urgent ? 'bg-status-danger' : 'bg-accent-600'
                  }`}
                >
                  {action.badge > 9 ? '9+' : action.badge}
                </span>
              ) : null}
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${
                action.urgent ? 'bg-status-danger/10 text-status-danger' : 'bg-accent-50 text-accent-600'
              }`}>
                <action.icon className="h-5 w-5" />
              </span>
              <span className="text-caption-xs font-semibold leading-tight text-gray-700 transition-colors group-hover:text-accent-700">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Activity + staff on duty ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5 animate-fade-in-up" style={{ animationDelay: '0.16s' }}>
        <Panel
          icon={Clock}
          title="Recent activity"
          hint="Tickets, notices and payments, newest first"
          className="lg:col-span-3"
          meta={
            dashboard.recentActivity.length > 0 ? (
              <CountPill>{dashboard.recentActivity.length} recent</CountPill>
            ) : undefined
          }
        >
          {dashboard.recentActivity.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {dashboard.recentActivity.map((activity, i) => {
                const Icon = activityIconMap[activity.type] || Clock;
                return (
                  <li key={i} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-gray-50/80">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="mt-0.5 text-caption-xs capitalize text-gray-500">
                        {activity.type}
                        <span className="mx-1.5 text-gray-300">&middot;</span>
                        {timeAgo(activity.time)}
                      </p>
                    </div>
                    {activity.status && (
                      <StatusBadge variant={statusVariant(activity.status)} dot={false}>
                        {activity.status.replace(/_/g, ' ')}
                      </StatusBadge>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <PanelEmpty
              icon={Clock}
              title="Nothing here yet"
              description="Ticket updates, new notices and payments will appear here as they happen."
            />
          )}
        </Panel>

        <Panel
          icon={Users}
          title="Staff on duty"
          hint="Who is on site right now"
          className="lg:col-span-2"
          meta={dashboard.onDutyStaff.length > 0 ? <CountPill>{dashboard.onDutyStaff.length} on duty</CountPill> : undefined}
          action={
            <button
              onClick={() => router.push('/dashboard/resident/faqs')}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent-600 px-3 py-2.5 text-caption-xs font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Need help?
            </button>
          }
        >
          {dashboard.onDutyStaff.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {dashboard.onDutyStaff.map((s, i) => (
                <li key={i} className="flex items-center gap-3.5 px-5 py-3.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-50 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-100">
                    {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-gray-900">{s.name}</p>
                    <p className="mt-0.5 text-caption-xs capitalize text-gray-500">{s.role.toLowerCase()}</p>
                  </div>
                  <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-700 ring-1 ring-accent-200/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
                    On duty
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty
              icon={Users}
              title="No one checked in"
              description="Staff hours are shown here whenever someone is clocked in at the gate."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── SOS Emergency Button ─────────────────────────────────────────────────
// The one deliberately loud element on this page: an emergency control should
// not look like the cards around it.
function SOSButton({ unitId, onTriggered }: { unitId: string; onTriggered: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [category, setCategory] = useState<string>('OTHER');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    { value: 'MEDICAL', label: 'Medical', emoji: '🏥' },
    { value: 'FIRE', label: 'Fire', emoji: '🔥' },
    { value: 'SECURITY', label: 'Security', emoji: '🛡️' },
    { value: 'OTHER', label: 'Other', emoji: '⚠️' },
  ];

  const handleTrigger = async () => {
    if (!unitId) {
      setError('No unit assigned to your account. Please contact admin.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await apiPost('/api/v1/sos-alerts', { category, unitId });
      setSent(true);
      setShowConfirm(false);
      onTriggered();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to send alert. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const shell = 'relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-[0_1px_3px_rgba(15,23,42,0.06)]';

  const header = (title: string, sub: string) => (
    <div className="flex items-start gap-3 border-b border-red-100 px-5 py-4">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_8px_20px_-12px_rgba(220,38,38,1)]">
        <AlertTriangle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-body font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-caption-xs text-gray-500">{sub}</p>
      </div>
    </div>
  );

  if (sent) {
    return (
      <div className={`${shell} border-emerald-200 bg-emerald-50`}>
        <span className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500" aria-hidden="true" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-emerald-200">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </span>
          <h3 className="text-title-sm font-display text-gray-900">Alert sent</h3>
          <p className="mt-1.5 max-w-xs text-body-sm text-gray-600">
            Every admin and guard has been notified. Help is on the way.
          </p>
          <button
            onClick={() => { setSent(false); setCategory('OTHER'); }}
            className="mt-5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-body-sm font-medium text-emerald-700 transition-all hover:bg-emerald-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className={`${shell} border-red-200 bg-white`}>
        <span className="absolute inset-x-0 top-0 h-0.5 bg-red-500" aria-hidden="true" />
        {header('Emergency type', 'Choose what is happening, then send')}
        <div className="flex-1 px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                aria-pressed={category === cat.value}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 transition-all ${
                  category === cat.value
                    ? 'border-red-400 bg-red-50 ring-4 ring-red-500/10'
                    : 'border-gray-200/80 bg-white hover:border-red-200 hover:bg-red-50/40'
                }`}
              >
                <span className="text-xl" aria-hidden="true">{cat.emoji}</span>
                <span className={`text-caption-xs font-semibold ${category === cat.value ? 'text-red-700' : 'text-gray-700'}`}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
          {error && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-caption-xs text-red-700">{error}</p>
          )}
        </div>
        <div className="flex gap-2.5 border-t border-gray-100 px-5 py-4">
          <button
            onClick={handleTrigger}
            disabled={sending}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(220,38,38,1)] transition-all hover:bg-red-700 disabled:opacity-60"
          >
            {sending ? 'Sending...' : 'Send SOS alert'}
          </button>
          <button
            onClick={() => { setShowConfirm(false); setError(''); }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className={`${shell} group w-full border-red-200 bg-white text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-[0_12px_28px_-14px_rgba(220,38,38,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500`}
    >
      <span className="absolute inset-x-0 top-0 h-0.5 bg-red-500" aria-hidden="true" />
      {header('SOS emergency', 'Reaches every admin and guard at once')}
      <div className="flex flex-1 items-center gap-4 px-5 py-5">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100 transition-transform duration-300 group-hover:scale-105">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-gray-900">Tap to raise an alarm</p>
          <p className="mt-0.5 text-caption-xs leading-relaxed text-gray-500">
            Medical, fire or security. Use only for real emergencies.
          </p>
        </div>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-red-500" />
      </div>
    </button>
  );
}
