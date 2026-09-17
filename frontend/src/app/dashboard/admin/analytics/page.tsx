'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Wallet, Clock, Star, Tags, TrendingUp, BarChart3, AlertCircle,
  Trophy, Users, Activity, CalendarDays, AlertTriangle, Building2, Home,
  QrCode, Package, UserPlus, Shield, CircleCheck, Receipt,
} from 'lucide-react';
import { ApiError, apiGet } from '@/lib/api';
import { PageSkeleton } from '@/components/ui/LoadingScreen';

// Amounts are stored in paisa (rupees x 100) - format as Pakistani Rupees.
const formatRs = (paisa: number) =>
  `Rs ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatCompact = (paisa: number) => {
  const rupees = paisa / 100;
  if (rupees >= 10000000) return `Rs ${(rupees / 10000000).toFixed(1)}cr`;
  if (rupees >= 100000) return `Rs ${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `Rs ${(rupees / 1000).toFixed(1)}k`;
  return `Rs ${Math.round(rupees)}`;
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type RangeKey = '1m' | '6m' | '1y';

const RANGES: { value: RangeKey; label: string; hint: string }[] = [
  { value: '1m', label: '1M', hint: 'Last month' },
  { value: '6m', label: '6M', hint: 'Last six months' },
  { value: '1y', label: '1Y', hint: 'Last year' },
];

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

interface VendorRow {
  vendorName: string;
  avgRating: number;
  ratingCount: number;
  closedTickets: number;
}

interface AnalyticsData {
  range: RangeKey;
  granularity: 'week' | 'month';
  windowStart: string;
  windowEnd: string;
  trend: { key: string; label: string; invoiced: number; collected: number; rate: number | null }[];
  dues: {
    invoiced: number;
    collected: number;
    collectionRate: number | null;
    paymentsReceived: number;
    outstanding: number;
    outstandingCount: number;
    overdueAmount: number;
    overdueCount: number;
  };
  tickets: {
    created: number;
    closed: number;
    openNow: number;
    byStatus: { status: string; count: number }[];
    byCategory: { category: string; count: number }[];
    busiestCategory: { category: string; count: number } | null;
    avgResolutionHours: number | null;
    avgResolutionDays: number | null;
    openOldestDays: number | null;
  };
  vendors: {
    performance: VendorRow[];
    assignedCount: number;
    ratedCount: number;
    closedCount: number;
  };
  people: {
    newMembers: number;
    activeResidents: number;
    activeGuards: number;
    visitorPasses: number;
    visitorsOnSite: number;
    pendingVisitors: number;
    parcelsLogged: number;
    parcelsWaiting: number;
  };
  occupancy: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    ownerOccupied: number;
    rented: number;
    occupancyRate: number | null;
  };
  // Kept server-side for the dashboard home tiles.
  duesCollection: { month: string; invoiced: number; collected: number; rate: number | null }[];
  ticketResolution: { closedCount: number; avgHours: number | null; avgDays: number | null };
}

const EMPTY: AnalyticsData = {
  range: '6m',
  granularity: 'month',
  windowStart: '',
  windowEnd: '',
  trend: [],
  dues: {
    invoiced: 0, collected: 0, collectionRate: null, paymentsReceived: 0,
    outstanding: 0, outstandingCount: 0, overdueAmount: 0, overdueCount: 0,
  },
  tickets: {
    created: 0, closed: 0, openNow: 0, byStatus: [], byCategory: [],
    busiestCategory: null, avgResolutionHours: null, avgResolutionDays: null, openOldestDays: null,
  },
  vendors: { performance: [], assignedCount: 0, ratedCount: 0, closedCount: 0 },
  people: {
    newMembers: 0, activeResidents: 0, activeGuards: 0, visitorPasses: 0,
    visitorsOnSite: 0, pendingVisitors: 0, parcelsLogged: 0, parcelsWaiting: 0,
  },
  occupancy: { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, ownerOccupied: 0, rented: 0, occupancyRate: null },
  duesCollection: [],
  ticketResolution: { closedCount: 0, avgHours: null, avgDays: null },
};

// ── Presentation pieces ────────────────────────────────────────────────
function StatTile({
  label, value, sub, icon: Icon, tone = 'accent',
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone?: 'accent' | 'danger' | 'success';
}) {
  const tones = {
    accent: 'bg-accent-50 text-accent-600',
    danger: 'bg-red-50 text-red-600',
    success: 'bg-emerald-50 text-emerald-600',
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className="absolute inset-x-0 top-0 h-1 bg-accent-500" aria-hidden="true" />
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase leading-snug tracking-[0.16em] text-gray-400">{label}</span>
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${tones}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-display font-display tabular-nums text-gray-900">{value}</p>
      <p className="mt-1 text-caption-xs leading-relaxed text-gray-500">{sub}</p>
    </div>
  );
}

function Panel({
  icon: Icon, title, hint, right, className = '', children,
}: {
  icon: React.ElementType;
  title: string;
  hint: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}>
      <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" aria-hidden="true" />
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
          <Icon className="h-4 w-4 text-accent-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-body-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-caption-xs leading-relaxed text-gray-500">{hint}</p>
        </div>
        {right && <div className="flex flex-shrink-0 items-center gap-2">{right}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyPanel({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-gray-200/70">
        <Icon className="h-5 w-5 text-gray-300" />
      </div>
      <p className="text-body-sm font-medium text-gray-600">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-caption-xs leading-relaxed text-gray-400">{hint}</p>
    </div>
  );
}

/** Compact label + number used inside the snapshot panels. */
function Mini({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-title-sm font-display tabular-nums leading-tight text-gray-900">{value}</p>
        <p className="truncate text-caption-xs text-gray-500">{hint || label}</p>
      </div>
    </div>
  );
}

function Stars({ value, className = 'h-4 w-4' }: { value: number; className?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${className} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-500' : 'text-gray-200'}`}
        />
      ))}
    </span>
  );
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>('6m');
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (selected: RangeKey, firstLoad: boolean) => {
      if (!firstLoad) setRefreshing(true);
      try {
        const result = await apiGet<AnalyticsData>(`/api/v1/analytics?range=${selected}`);
        setData(result || { ...EMPTY, range: selected });
        setError('');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not load analytics');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    load(range, true);
  }, [range, load]);

  const maxInvoiced = Math.max(1, ...data.trend.map((d) => d.invoiced));
  const maxCollected = Math.max(1, ...data.trend.map((d) => d.collected));
  const maxCategoryCount = Math.max(1, ...data.tickets.byCategory.map((c) => c.count));
  const totalByStatus = data.tickets.byStatus.reduce((s, t) => s + t.count, 0);
  const trendEmpty = data.trend.every((d) => d.invoiced === 0 && d.collected === 0);
  const activeRange = RANGES.find((r) => r.value === range)!;

  if (loading) {
    return <PageSkeleton width="max-w-6xl" />;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/admin')}
              aria-label="Back to dashboard"
              className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200 shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-display-sm font-display text-gray-900">Analytics</h1>
                <p className="text-body-sm text-gray-500">Collections, work orders, occupancy and community traffic</p>
              </div>
            </div>
          </div>

          {/* Range switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Reporting range"
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              {RANGES.map((r) => {
                const active = r.value === range;
                return (
                  <button
                    key={r.value}
                    role="tab"
                    aria-selected={active}
                    title={r.hint}
                    onClick={() => setRange(r.value)}
                    className={`rounded-lg px-3.5 py-1.5 text-body-sm font-semibold transition-all ${
                      active
                        ? 'bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-caption-xs font-medium text-gray-500">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              {data.windowStart
                ? `${shortDate(data.windowStart)} - ${shortDate(data.windowEnd)}`
                : activeRange.hint}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="flex-1 text-body-sm text-red-700">{error}</p>
          </div>
        )}

        <div className={`transition-opacity duration-200 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
          {/* ── Range summary ────────────────────────────────────── */}
          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Collected"
              value={formatRs(data.dues.collected)}
              sub={`${data.dues.paymentsReceived} payment${data.dues.paymentsReceived === 1 ? '' : 's'} in the last ${activeRange.hint.toLowerCase().replace('last ', '')}`}
              icon={Wallet}
              tone="success"
            />
            <StatTile
              label="Invoiced"
              value={formatRs(data.dues.invoiced)}
              sub="Billed in the same window"
              icon={Receipt}
            />
            <StatTile
              label="Collection rate"
              value={data.dues.collectionRate != null ? `${data.dues.collectionRate}%` : '-'}
              sub={data.dues.collectionRate != null ? 'Collected against billed in this window' : 'No invoices raised in this window'}
              icon={TrendingUp}
            />
            <StatTile
              label="Outstanding"
              value={formatRs(data.dues.outstanding)}
              sub={`${data.dues.outstandingCount} unpaid invoice${data.dues.outstandingCount === 1 ? '' : 's'} right now`}
              icon={AlertTriangle}
              tone={data.dues.outstanding > 0 ? 'danger' : 'accent'}
            />
          </div>

          {/* ── Collection trend ─────────────────────────────────── */}
          <Panel
            icon={BarChart3}
            title="Collections over time"
            hint={`Billed against collected per ${data.granularity === 'week' ? 'week' : 'month'}, with the collection rate above each pair`}
            className="mb-7"
          >
            {trendEmpty ? (
              <EmptyPanel
                icon={Wallet}
                title="No invoices or payments in this window"
                hint="Raise an invoice from the Invoices page, or widen the range above."
              />
            ) : (
              <>
                <div className="relative flex h-56 items-end gap-2 sm:gap-4">
                  <div className="pointer-events-none absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between" aria-hidden="true">
                    {[0, 1, 2, 3].map((n) => (
                      <span key={n} className="h-px w-full bg-gray-100" />
                    ))}
                  </div>

                  {data.trend.map((d) => {
                    const invoicedH = d.invoiced > 0 ? Math.max(4, (d.invoiced / maxInvoiced) * 100) : 2;
                    const collectedH = d.collected > 0 ? Math.max(4, (d.collected / maxCollected) * 100) : 2;
                    return (
                      <div
                        key={d.key}
                        className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
                        title={`${d.label}: invoiced ${formatRs(d.invoiced)}, collected ${formatRs(d.collected)}`}
                      >
                        <span className={`text-caption-xs font-semibold tabular-nums ${d.rate != null ? 'text-gray-700' : 'text-gray-300'}`}>
                          {d.rate != null ? `${d.rate}%` : '-'}
                        </span>
                        <div className="flex w-full flex-1 items-end justify-center gap-1">
                          <div
                            className="w-1/3 max-w-7 rounded-t-md bg-gray-200 transition-all duration-500 hover:bg-gray-300"
                            style={{ height: `${invoicedH}%` }}
                            title={`Invoiced ${formatRs(d.invoiced)}`}
                          />
                          <div
                            className="w-1/3 max-w-7 rounded-t-md bg-gradient-to-t from-accent-600 to-accent-400 shadow-[0_-2px_8px_-2px_rgba(37,99,235,0.5)] transition-all duration-500"
                            style={{ height: `${collectedH}%` }}
                            title={`Collected ${formatRs(d.collected)}`}
                          />
                        </div>
                        <span className="truncate text-[10px] font-medium uppercase tracking-wider text-gray-400">{d.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-5 text-caption-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-sm bg-gradient-to-t from-accent-600 to-accent-400" />
                      Collected
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-sm bg-gray-200" />
                      Invoiced
                    </span>
                  </div>
                  <p className="text-caption-xs text-gray-400">
                    Peak collected {formatCompact(Math.max(0, ...data.trend.map((d) => d.collected)))}
                  </p>
                </div>
              </>
            )}
          </Panel>

          {/* ── Work orders + dues health ────────────────────────── */}
          <div className="mb-7 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <Panel
              icon={Activity}
              title="Work orders"
              hint={`Tickets raised and closed in the ${activeRange.hint.toLowerCase()}`}
              className="lg:col-span-2"
              right={
                data.tickets.openOldestDays != null ? (
                  <span className={`rounded-full px-2.5 py-0.5 text-caption-xs font-semibold ring-1 ${
                    data.tickets.openOldestDays >= 7
                      ? 'bg-red-50 text-red-700 ring-red-200/70'
                      : 'bg-gray-50 text-gray-600 ring-gray-200/70'
                  }`}>
                    Oldest open {data.tickets.openOldestDays}d
                  </span>
                ) : undefined
              }
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                <Mini icon={Tags} label="Raised" value={data.tickets.created} hint="Raised in this window" />
                <Mini icon={CircleCheck} label="Closed" value={data.tickets.closed} hint="Closed in this window" />
                <Mini icon={Activity} label="Open now" value={data.tickets.openNow} hint="Open, assigned or in progress" />
                <Mini
                  icon={Clock}
                  label="Avg resolution"
                  value={data.tickets.avgResolutionDays != null ? `${data.tickets.avgResolutionDays}d` : '-'}
                  hint={data.tickets.avgResolutionDays != null ? 'From raise to close' : 'No closed tickets yet'}
                />
              </div>

              {totalByStatus > 0 && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                    Every ticket by status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.tickets.byStatus.map((s) => (
                      <span
                        key={s.status}
                        className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-caption-xs font-medium text-gray-600 ring-1 ring-gray-200/70"
                      >
                        {STATUS_LABELS[s.status] || s.status}
                        <span className="font-semibold tabular-nums text-gray-900">{s.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel icon={Wallet} title="Dues health" hint="Money owed as of today">
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Outstanding</p>
                  <p className={`mt-1 text-title font-display tabular-nums ${data.dues.outstanding > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatRs(data.dues.outstanding)}
                  </p>
                  <p className="mt-0.5 text-caption-xs text-gray-500">
                    {data.dues.outstandingCount === 0
                      ? 'Every invoice is settled'
                      : `${data.dues.outstandingCount} invoice${data.dues.outstandingCount === 1 ? '' : 's'} still open`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                  <Mini icon={AlertTriangle} label="Overdue" value={formatRs(data.dues.overdueAmount)} hint={`${data.dues.overdueCount} past due`} />
                  <Mini icon={Receipt} label="Payments" value={data.dues.paymentsReceived} hint="Received in this window" />
                </div>

                {data.dues.overdueCount > 0 && (
                  <button
                    onClick={() => router.push('/dashboard/admin/invoices')}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
                  >
                    Follow up on invoices
                  </button>
                )}
              </div>
            </Panel>
          </div>

          {/* ── Category + vendors + occupancy ───────────────────── */}
          <div className="mb-7 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <Panel
              icon={Tags}
              title="Tickets by category"
              hint={
                data.tickets.byCategory.length > 0
                  ? `${data.tickets.byCategory.reduce((s, c) => s + c.count, 0)} raised in this window`
                  : 'What residents reported in this window'
              }
            >
              {data.tickets.byCategory.length === 0 ? (
                <EmptyPanel icon={Activity} title="No tickets in this window" hint="Try a longer range, or wait for residents to raise something." />
              ) : (
                <div className="space-y-4">
                  {data.tickets.byCategory.map((c) => (
                    <div key={c.category}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="text-body-sm font-medium capitalize text-gray-700">{c.category}</span>
                        <span className="flex-shrink-0 rounded-full bg-gray-50 px-2 py-0.5 text-caption-xs font-semibold tabular-nums text-gray-500 ring-1 ring-gray-200/70">
                          {c.count}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-700"
                          style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              icon={TrendingUp}
              title="Vendor performance"
              hint="Ratings from tickets closed in this window"
              right={
                data.vendors.ratedCount > 0 ? (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-caption-xs font-semibold text-gray-600">
                    {data.vendors.performance.length}
                  </span>
                ) : undefined
              }
            >
              {data.vendors.performance.length === 0 ? (
                <EmptyPanel icon={Star} title="No vendor ratings in this window" hint="Close a ticket with a rating and that vendor appears here." />
              ) : (
                <div className="space-y-2.5">
                  {data.vendors.performance.map((v, i) => (
                    <div
                      key={v.vendorName}
                      className="group flex items-center gap-3.5 rounded-2xl border border-gray-200/80 bg-gray-50/60 px-4 py-3 transition-all duration-300 hover:border-accent-200 hover:bg-white hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                    >
                      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200">
                        <Users className="h-4 w-4 text-white" />
                        {i === 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white">
                            <Trophy className="h-2.5 w-2.5 text-white" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-semibold text-gray-900">{v.vendorName}</p>
                        <p className="text-caption-xs text-gray-400">
                          {v.ratingCount} rating{v.ratingCount === 1 ? '' : 's'} &middot; {v.closedTickets} closed
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="mb-0.5 flex justify-end">
                          <Stars value={v.avgRating} className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-caption-xs font-semibold tabular-nums text-gray-700">{v.avgRating.toFixed(1)} / 5</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel icon={Building2} title="Occupancy" hint="A live snapshot, not tied to the range">
              <div className="flex items-baseline gap-2">
                <p className="text-display font-display tabular-nums text-gray-900">
                  {data.occupancy.occupancyRate != null ? `${data.occupancy.occupancyRate}%` : '-'}
                </p>
                <p className="text-body-sm text-gray-500">of units occupied</p>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 transition-all duration-700"
                  style={{ width: `${data.occupancy.occupancyRate ?? 0}%` }}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <Mini icon={Home} label="Occupied" value={data.occupancy.occupiedUnits} hint={`${data.occupancy.ownerOccupied} owner, ${data.occupancy.rented} rented`} />
                <Mini icon={Building2} label="Vacant" value={data.occupancy.vacantUnits} hint={`of ${data.occupancy.totalUnits} units`} />
              </div>
            </Panel>
          </div>

          {/* ── Community & traffic ──────────────────────────────── */}
          <Panel
            icon={Users}
            title="Community &amp; gate traffic"
            hint={`New members, visitor passes and parcels in the ${activeRange.hint.toLowerCase()}`}
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Members</p>
                <Mini icon={UserPlus} label="Joined" value={data.people.newMembers} hint="New members in this window" />
                <Mini icon={Users} label="Residents" value={data.people.activeResidents} hint="Active resident accounts" />
                <Mini icon={Shield} label="Guards" value={data.people.activeGuards} hint="Active guards" />
              </div>

              <div className="space-y-4 sm:border-l sm:border-gray-100 sm:pl-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Visitors</p>
                <Mini icon={QrCode} label="Passes" value={data.people.visitorPasses} hint="Passes created in this window" />
                <Mini icon={Users} label="On site" value={data.people.visitorsOnSite} hint="Checked in right now" />
                <Mini icon={AlertTriangle} label="Pending" value={data.people.pendingVisitors} hint="Waiting for approval" />
              </div>

              <div className="space-y-4 sm:border-l sm:border-gray-100 sm:pl-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Parcels</p>
                <Mini icon={Package} label="Logged" value={data.people.parcelsLogged} hint="Received in this window" />
                <Mini icon={Package} label="Waiting" value={data.people.parcelsWaiting} hint="Not collected yet" />
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
