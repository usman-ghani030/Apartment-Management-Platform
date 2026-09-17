'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, FileText, CreditCard, Shield,
  CalendarRange, UserPlus, Ticket, Wrench, ChevronRight, QrCode,
  AlertTriangle, Folder, Package, Megaphone, Clock, Wallet, ArrowRight,
  CircleCheck, Activity,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import type { NoticeResponse, ParcelResponse, DocumentResponse } from '@apartment/shared';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { useAdminShell } from '@/components/dashboard/admin-shell';

// ── Time helper ───────────────────────────────────────────────────────
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

// ── Panel chrome: one accent (blue) for the whole dashboard so every panel
//    reads as part of the same system. Colour is reserved for status only. ──
const ACCENT = {
  rule: 'bg-accent-500',
  chip: 'from-accent-500 to-accent-600 ring-accent-200',
  link: 'text-accent-600 hover:bg-accent-50 hover:text-accent-700',
} as const;

// ── Stat tile (reference-style: colored top rule, icon chip, sub-badge) ──
const statTones = {
  accent: {
    rule: 'bg-accent-500',
    icon: 'bg-accent-50 text-accent-600',
    chip: 'bg-accent-50 text-accent-700 border-accent-100',
  },
  danger: {
    rule: 'bg-status-danger',
    icon: 'bg-status-danger/10 text-status-danger',
    chip: 'bg-status-danger/10 text-status-danger border-status-danger/20',
  },
  warning: {
    rule: 'bg-status-warning',
    icon: 'bg-status-warning/10 text-status-warning',
    chip: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  },
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  tone = 'accent',
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub: string;
  tone?: keyof typeof statTones;
  onClick?: () => void;
}) {
  const t = statTones[tone];
  return (
    <button
      onClick={onClick}
      className="group relative bg-white border border-gray-200 rounded-xl shadow-sm p-5 text-left w-full overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
    >
      {/* Colored top rule */}
      <span className={`absolute top-0 left-0 right-0 h-1 ${t.rule}`} aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-display font-bold text-gray-900 leading-none mt-3">{value}</p>
          <p className="text-caption-xs text-gray-500 mt-2.5">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${t.icon}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </button>
  );
}

// ── Section eyebrow (matches the landing page system) ─────────────────
function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3.5">
      <span className="h-4 w-1 rounded-full bg-accent-400" aria-hidden="true" />
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em]">{children}</p>
      <span className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" aria-hidden="true" />
      {right}
    </div>
  );
}

/** Small uppercase caption used above values inside panels. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">{children}</p>;
}

/** "View all" style link used in panel headers. */
function PanelLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption-xs font-semibold transition-all ${ACCENT.link}`}
    >
      {label}
      <ArrowRight className="w-3 h-3" />
    </button>
  );
}

/** Shared panel shell: coloured top rule, icon-chip header, optional footer. */
function Panel({
  icon: Icon,
  title,
  caption,
  right,
  footer,
  className = '',
  children,
}: {
  icon: React.ElementType;
  title: string;
  caption: string;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`group/panel relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-10px_rgba(37,99,235,0.22)] ${className}`}
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${ACCENT.rule}`} aria-hidden="true" />

      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${ACCENT.chip} ring-1 transition-transform duration-300 group-hover/panel:scale-105`}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-body-sm font-semibold leading-tight text-gray-900">{title}</p>
          <p className="text-caption-xs text-gray-500">{caption}</p>
        </div>
        {right && <div className="ml-auto flex flex-shrink-0 items-center gap-2">{right}</div>}
      </div>

      <div className="flex flex-1 flex-col">{children}</div>

      {footer && (
        <div className="mt-auto border-t border-gray-100 bg-gray-50/70 p-3">{footer}</div>
      )}
    </div>
  );
}

/** Footer button used by the panel footers. */
function PanelButton({
  icon: Icon,
  label,
  onClick,
  variant = 'ghost',
}: {
  icon?: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'ghost' | 'primary';
}) {
  const styles =
    variant === 'primary'
      ? 'bg-accent-600 text-white hover:bg-accent-700 shadow-[0_8px_20px_-12px_rgba(37,99,235,0.9)]'
      : 'border border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 hover:shadow-sm';
  return (
    <button
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-caption-xs font-semibold transition-all duration-200 ${styles}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

/** Small "nothing here yet" block used inside panels. */
function PanelEmpty({ icon: Icon, tone = 'bg-accent-50', iconTone = 'text-accent-500', title, hint }: { icon: React.ElementType; tone?: string; iconTone?: string; title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className={`w-5 h-5 ${iconTone}`} />
      </div>
      <p className="text-body-sm font-medium text-gray-600">{title}</p>
      <p className="mt-0.5 max-w-[16rem] text-caption-xs leading-relaxed text-gray-400">{hint}</p>
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { user, stats, recentTickets, statsLoading } = useAdminShell();
  const [activeSosCount, setActiveSosCount] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [parcels, setParcels] = useState<ParcelRow[]>([]);

  useEffect(() => {
    apiGet<{ count: number }>('/api/v1/sos-alerts/active-count')
      .then((res) => setActiveSosCount(res.count))
      .catch(() => {});
    // Financial & operations + community activity panels (all read-only, best-effort)
    apiGet<AnalyticsData>('/api/v1/analytics').then(setAnalytics).catch(() => {});
    apiGet<NoticeRow[]>('/api/v1/notices').then((d) => setNotices((d || []).slice(0, 4))).catch(() => {});
    apiGet<DocumentRow[]>('/api/v1/documents').then((d) => setDocuments((d || []).slice(0, 4))).catch(() => {});
    apiGet<ParcelRow[]>('/api/v1/parcels?status=ARRIVED').then((d) => setParcels((d || []).slice(0, 4))).catch(() => {});
  }, []);

  // Skeleton in the content area: the shell (sidebar + top bar) is already up,
  // so a full-screen spinner here would fight it.
  if (statsLoading) {
    return <PageSkeleton />;
  }

  const firstName = user?.user.name?.split(' ')[0] || 'Admin';

  // The panel has to keep a predictable height next to "Needs your attention",
  // so it shows a bounded list (with a footer link) instead of growing with
  // every new ticket.

  // ── Dues panel math (current calendar month, from /analytics) ──────
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = analytics?.duesCollection.find((m) => m.month === monthKey);
  const currentRate = currentMonth?.rate ?? null;
  const outstandingThisMonth = currentMonth ? Math.max(0, currentMonth.invoiced - currentMonth.collected) : 0;
  const hasDuesActivity = Boolean(currentMonth && (currentMonth.invoiced > 0 || currentMonth.collected > 0));

  const RECENT_TICKET_LIMIT = 4;
  const visibleTickets = recentTickets.slice(0, RECENT_TICKET_LIMIT);
  const hiddenTicketCount = Math.max(0, recentTickets.length - visibleTickets.length);

  // ── Maintenance panel counts ────────────────────────────────────────
  const inProgressCount = recentTickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedCount = Math.max(
    recentTickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
    analytics?.ticketResolution.closedCount ?? 0
  );
  const rawRole = user?.memberships?.[0]?.role as string | undefined;
  const roleLabel = rawRole
    ? rawRole.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const statusVariant = (s: string) => {
    if (s === 'OPEN' || s === 'ASSIGNED') return 'warning' as const;
    if (s === 'IN_PROGRESS') return 'info' as const;
    if (s === 'RESOLVED' || s === 'CLOSED') return 'success' as const;
    return 'neutral' as const;
  };

  // Build attention items
  const attentionItems: Array<{
    icon: React.ElementType;
    title: string;
    subtitle: string;
    href: string;
    urgent: boolean;
    category: string;
  }> = [];

  if (stats.openTickets > 0) {
    attentionItems.push({
      icon: Ticket,
      title: `${stats.openTickets} open ticket${stats.openTickets > 1 ? 's' : ''}`,
      subtitle: 'Residents waiting for resolution',
      href: '/dashboard/admin/tickets',
      urgent: true,
      category: 'Maintenance',
    });
  }
  if (stats.pendingVisitors > 0) {
    attentionItems.push({
      icon: QrCode,
      title: `${stats.pendingVisitors} pending visitor pass${stats.pendingVisitors > 1 ? 'es' : ''}`,
      subtitle: 'Awaiting approval',
      href: '/dashboard/admin/visitors',
      urgent: false,
      category: 'Security',
    });
  }
  if (stats.pendingInvoices > 0) {
    attentionItems.push({
      icon: CreditCard,
      title: `${stats.pendingInvoices} pending due${stats.pendingInvoices > 1 ? 's' : ''}`,
      subtitle: 'Unpaid invoices need follow-up',
      href: '/dashboard/admin/invoices',
      urgent: true,
      category: 'Finance',
    });
  }
  if (activeSosCount > 0) {
    attentionItems.unshift({
      icon: AlertTriangle,
      title: `${activeSosCount} active SOS alert${activeSosCount > 1 ? 's' : ''}`,
      subtitle: 'Emergency alerts requiring immediate attention',
      href: '/dashboard/admin/sos-alerts',
      urgent: true,
      category: 'Safety',
    });
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-10">
      {/* ── Welcome ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-display font-display text-gray-900 tracking-tight">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}
            </h1>
            {roleLabel && (
              <span className="text-caption-xs font-semibold text-accent-700 bg-accent-50 border border-accent-100 px-2.5 py-1 rounded-full">
                {roleLabel}
              </span>
            )}
          </div>
          <p className="text-body-sm text-gray-500 mt-1">
            {stats.residents} active resident{stats.residents === 1 ? '' : 's'} across {stats.units} unit{stats.units === 1 ? '' : 's'}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-body-sm font-semibold text-gray-900">{today()}</p>
          <p className="text-caption-xs text-gray-500 mt-0.5">Society overview</p>
        </div>
      </div>

      {/* ── Stat tiles ────────────────────────────────────────────── */}
      <section className="animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <SectionLabel>At a glance</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatCard
          label="Total units"
          value={stats.units}
          icon={Building2}
          sub="Manage units"
          onClick={() => router.push('/dashboard/admin/units')}
        />
        <StatCard
          label="Active residents"
          value={stats.residents}
          icon={Users}
          sub="View members"
          onClick={() => router.push('/dashboard/admin/memberships')}
        />
        <StatCard
          label="Open tickets"
          value={stats.openTickets}
          icon={Ticket}
          tone={stats.openTickets > 0 ? 'danger' : 'accent'}
          sub={stats.openTickets > 0 ? 'Needs resolution' : 'All clear'}
          onClick={() => router.push('/dashboard/admin/tickets')}
        />
        <StatCard
          label="Pending dues"
          value={stats.pendingInvoices}
          icon={CreditCard}
          tone={stats.pendingInvoices > 0 ? 'warning' : 'accent'}
          sub={stats.pendingInvoices > 0 ? 'Needs follow-up' : 'All clear'}
          onClick={() => router.push('/dashboard/admin/invoices')}
        />
        </div>
      </section>

      {/* ── Main Grid: Attention + Recent Tickets ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {/* Left: Needs your attention */}
        <div className="flex flex-col lg:col-span-2">
          <SectionLabel
            right={
              attentionItems.length > 0 ? (
                <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-200/70">
                  {attentionItems.length} item{attentionItems.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-caption-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                  All clear
                </span>
              )
            }
          >
            Needs your attention
          </SectionLabel>

          <Panel
            icon={AlertTriangle}
            title="What needs a decision"
            caption={attentionItems.length > 0 ? 'Tap an item to jump straight to it' : 'Nothing is waiting on you'}
            className="flex-1"
          >
            {attentionItems.length > 0 ? (
              <div className="flex flex-1 flex-col divide-y divide-gray-100">
                {attentionItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => router.push(item.href)}
                    className="group relative flex w-full flex-1 items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1 bg-accent-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                    <div
                      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-105 ${
                        item.urgent ? 'bg-rose-50 text-rose-600 ring-rose-100' : 'bg-accent-50 text-accent-600 ring-accent-100'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="mt-0.5 text-caption text-gray-500">{item.subtitle}</p>
                    </div>

                    <span className="hidden flex-shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-caption-xs font-semibold text-gray-600 ring-1 ring-gray-200/70 sm:inline-flex">
                      {item.category}
                    </span>
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 transition-all duration-200 group-hover:bg-accent-600 group-hover:ring-accent-600">
                      <ChevronRight className="w-4 h-4 text-gray-300 transition-colors group-hover:text-white" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <PanelEmpty
                icon={CircleCheck}
                title="Everything looks good"
                hint="No pending items need your attention right now."
              />
            )}

            {/* Quick actions footer */}
            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-gray-100 bg-gray-50/70 p-3 sm:grid-cols-4">
              {[
                { icon: Ticket, label: 'New ticket', href: '/dashboard/admin/tickets' },
                { icon: FileText, label: 'Post notice', href: '/dashboard/admin/notices' },
                { icon: UserPlus, label: 'Invite resident', href: '/dashboard/admin/memberships' },
                { icon: CalendarRange, label: 'Manage amenities', href: '/dashboard/admin/amenities' },
              ].map((link) => (
                <button
                  key={link.label}
                  onClick={() => router.push(link.href)}
                  className="group flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-caption-xs font-semibold text-gray-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 hover:shadow-sm"
                >
                  <link.icon className="w-4 h-4 text-gray-400 transition-colors group-hover:text-accent-500" />
                  {link.label}
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right: Recent Tickets */}
        <div className="flex flex-col">
          <SectionLabel
            right={<PanelLink label="View all" onClick={() => router.push('/dashboard/admin/tickets')} />}
          >
            Recent tickets
          </SectionLabel>

          <Panel
            icon={Wrench}
            title="Latest work orders"
            caption="Newest first"
            className="flex-1"
            right={
              visibleTickets.length > 0 ? (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-caption-xs font-semibold text-gray-600">
                  {visibleTickets.length}
                </span>
              ) : undefined
            }
            footer={
              <PanelButton
                icon={Ticket}
                label={hiddenTicketCount > 0 ? `View ${hiddenTicketCount} more + all tickets` : 'View all tickets'}
                onClick={() => router.push('/dashboard/admin/tickets')}
              />
            }
          >
            {visibleTickets.length > 0 ? (
              <div className="flex flex-1 flex-col divide-y divide-gray-100">
                {visibleTickets.map((ticket) => {
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => router.push(`/dashboard/admin/tickets?id=${ticket.id}`)}
                      className="group relative flex w-full items-start gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-accent-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                    >
                      <span
                        className="absolute left-0 top-0 bottom-0 w-1 bg-accent-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        aria-hidden="true"
                      />
                      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100 transition-transform duration-300 group-hover:scale-105">
                        <Wrench className="w-4 h-4 text-accent-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-gray-900 transition-colors group-hover:text-accent-700">
                          {ticket.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                            <Users className="w-3 h-3 text-gray-400" />
                            {ticket.createdBy.name}
                          </span>
                          {ticket.unitNumber && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                              <Building2 className="w-3 h-3 text-gray-400" />
                              Unit {ticket.unitNumber}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {timeAgo(ticket.createdAt)}
                          </span>
                        </div>
                      </div>
                      <StatusBadge variant={statusVariant(ticket.status)} dot={false} className="mt-0.5 flex-shrink-0">
                        {ticket.status.replace(/_/g, ' ')}
                      </StatusBadge>
                    </button>
                  );
                })}
              </div>
            ) : (
              <PanelEmpty
                icon={Ticket}
                title="No recent tickets"
                hint="Tickets will appear here as residents submit them."
              />
            )}
          </Panel>
        </div>
      </div>

      {/* ── Financial & Operations ───────────────────────────────── */}
      <section>
        <SectionLabel>Financial &amp; operations</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 items-stretch">
          {/* Dues panel */}
          {/* Both panels stretch to the same height (align-items: stretch on the grid) */}
          <Panel
            icon={Wallet}
            title="Dues"
            caption={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            right={<PanelLink label="Manage" onClick={() => router.push('/dashboard/admin/invoices')} />}
            footer={
              <div className="grid grid-cols-2 gap-2">
                <PanelButton icon={FileText} label="All invoices" onClick={() => router.push('/dashboard/admin/invoices')} />
                <PanelButton icon={CreditCard} label="Create invoice" variant="primary" onClick={() => router.push('/dashboard/admin/invoices')} />
              </div>
            }
          >
            <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex items-center gap-3.5 p-5">
                {currentRate !== null ? (
                  <RateRing rate={currentRate} />
                ) : (
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Wallet className="w-4 h-4 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <Eyebrow>Collection rate</Eyebrow>
                  <p className="mt-0.5 text-title font-display tabular-nums text-gray-900">
                    {currentRate !== null ? `${currentRate}%` : '-'}
                  </p>
                  <p className="mt-0.5 text-caption-xs text-gray-500">
                    {hasDuesActivity
                      ? `${formatPaisa(currentMonth!.collected)} of ${formatPaisa(currentMonth!.invoiced)}`
                      : 'No invoices this month'}
                  </p>
                </div>
              </div>

              <div className="p-5">
                <Eyebrow>Collected</Eyebrow>
                <p className="mt-0.5 text-title font-display tabular-nums text-gray-900">
                  {formatPaisa(currentMonth?.collected ?? 0)}
                </p>
                <p className="mt-0.5 text-caption-xs text-gray-500">
                  Outstanding {formatPaisa(outstandingThisMonth)}
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, currentRate ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>
          </Panel>

          {/* Maintenance panel */}
          <Panel
            icon={Wrench}
            title="Maintenance"
            caption="Work orders"
            right={
              stats.openTickets > 0 ? (
                <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-caption-xs font-bold text-accent-700 ring-1 ring-accent-200/70">
                  +{stats.openTickets} open
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-caption-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                  All clear
                </span>
              )
            }
            footer={
              <PanelButton
                icon={Wrench}
                label="View all tickets"
                variant="primary"
                onClick={() => router.push('/dashboard/admin/tickets')}
              />
            }
          >
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="border-b border-gray-100 p-4">
                <MiniStat icon={AlertTriangle} tone="accent" value={stats.openTickets} label="Open" />
              </div>
              <div className="border-b border-gray-100 p-4">
                <MiniStat icon={Clock} tone="accent" value={inProgressCount} label="In progress" />
              </div>
              <div className="p-4">
                <MiniStat icon={CircleCheck} tone="accent" value={resolvedCount} label="Resolved" />
              </div>
              <div className="p-4">
                {analytics?.ticketResolution.avgDays != null ? (
                  <MiniStat icon={Activity} tone="neutral" value={`${analytics.ticketResolution.avgDays}d`} label="Avg resolution" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100">
                      <Activity className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-title font-bold leading-tight text-gray-300">-</p>
                      <p className="truncate text-caption-xs text-gray-400">No closed tickets</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </section>

      {/* ── Community activity ────────────────────────────────────── */}
      <section>
        <SectionLabel>Community activity</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch">
          {/* Notices */}
          <Panel
            icon={Megaphone}
            title="Notices"
            caption="Latest announcements"
            right={<PanelLink label="View all" onClick={() => router.push('/dashboard/admin/notices')} />}
          >
            {notices.length > 0 ? (
              <div className="flex-1 divide-y divide-gray-100">
                {notices.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => router.push('/dashboard/admin/notices')}
                    className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-accent-50/40"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100 transition-transform duration-300 group-hover:scale-105">
                      <Megaphone className="w-4 h-4 text-accent-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-gray-900 transition-colors group-hover:text-accent-700">
                        {n.title}
                      </p>
                      <p className="mt-0.5 truncate text-caption-xs text-gray-500">
                        {n.category.replace(/_/g, ' ')} &middot; {shortDate(n.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-200 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-accent-500" />
                  </button>
                ))}
              </div>
            ) : (
              <PanelEmpty
                icon={Megaphone}
                title="No notices published yet"
                hint="Post a notice and it will show up here for your residents."
              />
            )}
          </Panel>

          {/* Documents */}
          <Panel
            icon={Folder}
            title="Documents"
            caption="Files & records"
            right={<PanelLink label="View all" onClick={() => router.push('/dashboard/admin/documents')} />}
          >
            {documents.length > 0 ? (
              <div className="flex-1 divide-y divide-gray-100">
                {documents.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => router.push('/dashboard/admin/documents')}
                    className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-accent-50/40"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100 transition-transform duration-300 group-hover:scale-105">
                      <FileText className="w-4 h-4 text-accent-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-gray-900 transition-colors group-hover:text-accent-700">
                        {d.name}
                      </p>
                      <p className="mt-0.5 truncate text-caption-xs text-gray-500">
                        {d.folderName || 'General'} &middot; {formatSize(d.fileSize)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-200 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-accent-500" />
                  </button>
                ))}
              </div>
            ) : (
              <PanelEmpty
                icon={Folder}
                title="No documents uploaded yet"
                hint="Share society records so everyone can find them."
              />
            )}
          </Panel>

          {/* Parcels */}
          <Panel
            icon={Package}
            title="Parcels"
            caption="Awaiting collection"
            right={
              parcels.length > 0 ? (
                <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-200/70">
                  {parcels.length} waiting
                </span>
              ) : (
                <PanelLink label="View all" onClick={() => router.push('/dashboard/admin/parcels')} />
              )
            }
          >
            {parcels.length > 0 ? (
              <div className="flex-1 divide-y divide-gray-100">
                {parcels.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => router.push('/dashboard/admin/parcels')}
                    className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-accent-50/40"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100 transition-transform duration-300 group-hover:scale-105">
                      <Package className="w-4 h-4 text-accent-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-gray-900 transition-colors group-hover:text-accent-700">
                        Unit {p.unitNumber}
                      </p>
                      <p className="mt-0.5 truncate text-caption-xs text-gray-500">
                        {p.description || 'Package'} &middot; {timeAgo(p.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-200 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-accent-500" />
                  </button>
                ))}
              </div>
            ) : (
              <PanelEmpty
                icon={Package}
                title="No parcels waiting"
                hint="Parcels logged at the gate stay here until residents collect them."
              />
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}

// ── Row types for community activity panels ──────────────────────────
type NoticeRow = NoticeResponse;
type ParcelRow = ParcelResponse;
type DocumentRow = DocumentResponse;
interface AnalyticsData {
  // The dashboard reads only these two; the rest of the analytics payload is
  // consumed by the Analytics page.
  duesCollection: { month: string; invoiced: number; collected: number; rate: number | null }[];
  ticketResolution: { closedCount: number; avgHours: number | null; avgDays: number | null };
}

function today(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Dashboard panel helpers ───────────────────────────────────────────
const formatPaisa = (p: number) => `Rs ${(p / 100).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const formatSize = (bytes: number) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Circular collection-rate ring (reference-style). */
function RateRing({ rate }: { rate: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-11 h-11 flex-shrink-0" role="img" aria-label={`${rate}% collected`}>
      <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="18" cy="18" r={r} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, Math.max(0, rate)) / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-caption-xs font-bold text-gray-900">{rate}%</span>
    </div>
  );
}

/** Cell in the stats grid: small icon + number + caption. */
function MiniStat({ icon: Icon, tone, value, label }: { icon: React.ElementType; tone: 'accent' | 'neutral'; value: string | number; label: string }) {
  const tones = {
    accent: 'bg-accent-50 text-accent-600',
    neutral: 'bg-gray-100 text-gray-500',
  } as const;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-title font-bold text-gray-900 leading-tight tabular-nums">{value}</p>
        <p className="text-caption-xs text-gray-500 truncate">{label}</p>
      </div>
    </div>
  );
}
