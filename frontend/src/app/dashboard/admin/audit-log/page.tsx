'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Search, Download, X, ScrollText,
  ChevronLeft, ChevronRight, User, Layers,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { ApiError, apiGet } from '@/lib/api';
import type { AuditLogResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─────────────────────────────────────────────────────────────────────────────
// Audit trail - a searchable, filterable history of every recorded action.
// Each row is coloured by the entity type it acted on (the prefix of the
// action name, e.g. INVOICE_CREATED -> INVOICE).
// ─────────────────────────────────────────────────────────────────────────────

type EntityStyle = { chip: string; bar: string; dot: string };

const ENTITY_STYLES: Record<string, EntityStyle> = {
  SOCIETY: { chip: 'bg-blue-50 text-blue-700 ring-blue-200/70', bar: 'bg-blue-500', dot: 'bg-blue-500' },
  NOTICE: { chip: 'bg-amber-50 text-amber-700 ring-amber-200/70', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  TICKET: { chip: 'bg-purple-50 text-purple-700 ring-purple-200/70', bar: 'bg-purple-500', dot: 'bg-purple-500' },
  BOOKING: { chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200/70', bar: 'bg-indigo-500', dot: 'bg-indigo-500' },
  VOTE: { chip: 'bg-green-50 text-green-700 ring-green-200/70', bar: 'bg-green-500', dot: 'bg-green-500' },
  POLL: { chip: 'bg-rose-50 text-rose-700 ring-rose-200/70', bar: 'bg-rose-500', dot: 'bg-rose-500' },
  INVOICE: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  PAYMENT: { chip: 'bg-teal-50 text-teal-700 ring-teal-200/70', bar: 'bg-teal-500', dot: 'bg-teal-500' },
  VISITOR: { chip: 'bg-cyan-50 text-cyan-700 ring-cyan-200/70', bar: 'bg-cyan-500', dot: 'bg-cyan-500' },
  PARCEL: { chip: 'bg-yellow-50 text-yellow-700 ring-yellow-200/70', bar: 'bg-yellow-400', dot: 'bg-yellow-400' },
  DOCUMENT: { chip: 'bg-orange-50 text-orange-700 ring-orange-200/70', bar: 'bg-orange-500', dot: 'bg-orange-500' },
  MEMBERSHIP: { chip: 'bg-pink-50 text-pink-700 ring-pink-200/70', bar: 'bg-pink-500', dot: 'bg-pink-500' },
  UNIT: { chip: 'bg-sky-50 text-sky-700 ring-sky-200/70', bar: 'bg-sky-500', dot: 'bg-sky-500' },
  BUILDING: { chip: 'bg-violet-50 text-violet-700 ring-violet-200/70', bar: 'bg-violet-500', dot: 'bg-violet-500' },
  STAFF: { chip: 'bg-lime-50 text-lime-700 ring-lime-200/70', bar: 'bg-lime-500', dot: 'bg-lime-500' },
  AMENITY: { chip: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200/70', bar: 'bg-fuchsia-500', dot: 'bg-fuchsia-500' },
  SOS: { chip: 'bg-red-50 text-red-700 ring-red-200/70', bar: 'bg-red-500', dot: 'bg-red-500' },
  PLATFORM: { chip: 'bg-slate-100 text-slate-700 ring-slate-200/70', bar: 'bg-slate-500', dot: 'bg-slate-500' },
  AUTH: { chip: 'bg-accent-50 text-accent-700 ring-accent-200/70', bar: 'bg-accent-500', dot: 'bg-accent-500' },
};

const FALLBACK_STYLE: EntityStyle = {
  chip: 'bg-gray-100 text-gray-600 ring-gray-200/70',
  bar: 'bg-gray-400',
  dot: 'bg-gray-400',
};

/** INVOICE_CREATED -> INVOICE */
const entityOf = (action: string) => action.split('_')[0];
const styleOf = (action: string) => ENTITY_STYLES[entityOf(action)] || FALLBACK_STYLE;

/** INVOICE_CREATED -> "Created" */
const verbOf = (action: string) => {
  const rest = action.split('_').slice(1).join(' ').toLowerCase();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : action;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const initials = (name: string | null) => {
  if (!name) return 'SY';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'SY';
};

/** Field-level diff between before and after snapshots. */
function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!after) return [];
  return Object.entries(after)
    .filter(([k, v]) => !before || JSON.stringify(before[k]) !== JSON.stringify(v))
    .slice(0, 6);
}

function LogCard({ log }: { log: AuditLogResponse }) {
  const [open, setOpen] = useState(false);
  const style = styleOf(log.action);
  const changed = changedFields(log.beforeJson, log.afterJson);
  const hasDetails = Boolean(log.afterJson && Object.keys(log.afterJson).length > 0);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} aria-hidden="true" />

      <div className="px-5 py-4 pl-6">
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
          {/* Actor */}
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-caption-xs font-bold ring-1 ${style.chip}`}>
              {initials(log.actorName)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold ring-1 ${style.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  {log.action}
                </span>
                <span className="text-body-sm font-semibold text-gray-900">{verbOf(log.action)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                  <User className="h-3 w-3 text-gray-400" />
                  {log.actorName || 'System'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                  <Layers className="h-3 w-3 text-gray-400" />
                  {log.entityType}
                </span>
                <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 font-mono text-caption-xs text-gray-400">
                  {log.entityId.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamp + details toggle */}
          <div className="flex w-full flex-shrink-0 items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
            <span className="whitespace-nowrap text-caption-xs font-medium tabular-nums text-gray-400">
              {formatTime(log.createdAt)}
            </span>
            {hasDetails && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-caption-xs font-medium text-gray-600 transition-all hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
              >
                {open ? 'Hide details' : 'Details'}
              </button>
            )}
          </div>
        </div>

        {open && hasDetails && (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            {changed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {changed.map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-accent-50 px-2 py-1 text-caption-xs text-accent-800 ring-1 ring-accent-100"
                  >
                    <span className="font-semibold">{key}</span>
                    <span className="truncate text-accent-600">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {log.beforeJson && Object.keys(log.beforeJson).length > 0 && (
                <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/70">
                  <p className="border-b border-gray-200/70 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                    Before
                  </p>
                  <pre className="max-h-64 overflow-auto px-3.5 py-3 font-mono text-caption-xs leading-relaxed text-gray-600">
                    {JSON.stringify(log.beforeJson, null, 2)}
                  </pre>
                </div>
              )}
              <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/70">
                <p className="border-b border-gray-200/70 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                  After
                </p>
                <pre className="max-h-64 overflow-auto px-3.5 py-3 font-mono text-caption-xs leading-relaxed text-gray-600">
                  {JSON.stringify(log.afterJson, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminAuditLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (actionFilter) params.set('action', actionFilter);
      const data = await apiGet<{ logs: AuditLogResponse[]; total: number; page: number; totalPages: number }>(
        `/api/v1/audit-logs?${params.toString()}`
      );
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router, page, debouncedSearch, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Live search: wait for a pause in typing, then go back to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const exportUrl = `${API_BASE}/api/v1/audit-logs/export`;
  const filtersActive = Boolean(search || actionFilter);

  const grouped = useMemo(() => {
    const map = new Map<string, AuditLogResponse[]>();
    logs.forEach((log) => {
      const key = new Date(log.createdAt).toDateString();
      const bucket = map.get(key);
      if (bucket) bucket.push(log);
      else map.set(key, [log]);
    });
    return Array.from(map.entries());
  }, [logs]);

  // The API returns up to 50 rows per page (its default limit)
  const perPage = 50;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min((page - 1) * perPage + logs.length, total);

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/admin')}
            aria-label="Back to dashboard"
            className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Audit trail</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Every action recorded for your society, newest first.
            </p>
          </div>
          <a
            href={exportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actions, actors or entity ids..."
                aria-label="Search the audit trail"
                className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="w-full sm:w-56">
              <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
                <option value="">All action types</option>
                <option value="SOCIETY">Society</option>
                <option value="NOTICE">Notice</option>
                <option value="TICKET">Ticket</option>
                <option value="BOOKING">Booking</option>
                <option value="VOTE">Vote</option>
                <option value="INVOICE">Invoice</option>
                <option value="VISITOR">Visitor</option>
                <option value="DOCUMENT">Document</option>
                <option value="MEMBERSHIP">Membership</option>
                <option value="POLL">Poll</option>
              </Select>
            </div>

            {filtersActive && (
              <button
                onClick={() => { setSearch(''); setActionFilter(''); setPage(1); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
          {filtersActive && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-caption-xs text-gray-400">
              Showing {total} filtered record{total === 1 ? '' : 's'}
              {debouncedSearch ? ` matching “${debouncedSearch}”` : ''}
              {actionFilter ? ` in ${actionFilter.toLowerCase()}` : ''}.
            </p>
          )}
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200/80 bg-white py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
            <p className="text-body-sm text-gray-500">Loading the audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <ScrollText className="h-7 w-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">
              {filtersActive ? 'No matching records' : 'No activity recorded yet'}
            </h3>
            <p className="mx-auto max-w-md text-body-sm text-gray-500">
              {filtersActive
                ? 'Nothing matched those filters. Try a broader search or a different action type.'
                : 'Actions taken by admins, residents and guards are recorded here automatically.'}
            </p>
            {filtersActive && (
              <button
                onClick={() => { setSearch(''); setActionFilter(''); setPage(1); }}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
              >
                <X className="h-4 w-4" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 space-y-6">
              {grouped.map(([day, entries]) => (
                <section key={day}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                      {formatDay(entries[0].createdAt)}
                    </span>
                    <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-caption-xs font-medium text-gray-500 ring-1 ring-gray-200/80">
                      {entries.length} action{entries.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {entries.map((log) => <LogCard key={log.id} log={log} />)}
                  </div>
                </section>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <p className="text-caption-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{from}-{to}</span> of{' '}
                <span className="font-semibold text-gray-700">{total}</span> records
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span className="rounded-xl bg-gray-50 px-3.5 py-2 text-body-sm font-medium tabular-nums text-gray-700 ring-1 ring-gray-200/80">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
