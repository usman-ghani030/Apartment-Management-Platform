'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, QrCode, Search, CheckCircle2, XCircle, Phone, User, Car,
  Building2, Clock, X, Mail, Scan, CalendarDays, FileText, ChevronRight,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '@/components/ui/Modal';
import { ApiError, apiGet, apiPost, apiPatch } from '@/lib/api';
import type { VisitorPassResponse } from '@apartment/shared';

// Status drives the accent bar, icon chip and pill so the queue reads at a glance.
const STATUS_META: Record<string, { pill: string; bar: string; chip: string; label: string }> = {
  PENDING: {
    pill: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    bar: 'bg-amber-400',
    chip: 'from-amber-400 to-amber-500 ring-amber-200',
    label: 'Pending',
  },
  APPROVED: {
    pill: 'bg-accent-50 text-accent-700 ring-accent-200/70',
    bar: 'bg-accent-500',
    chip: 'from-accent-500 to-accent-600 ring-accent-200',
    label: 'Approved',
  },
  CHECKED_IN: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    bar: 'bg-emerald-500',
    chip: 'from-emerald-500 to-emerald-600 ring-emerald-200',
    label: 'Checked in',
  },
  CHECKED_OUT: {
    pill: 'bg-gray-100 text-gray-600 ring-gray-200/70',
    bar: 'bg-gray-300',
    chip: 'from-gray-400 to-gray-500 ring-gray-200',
    label: 'Checked out',
  },
  EXPIRED: {
    pill: 'bg-red-50 text-red-700 ring-red-200/70',
    bar: 'bg-red-400',
    chip: 'from-red-400 to-red-500 ring-red-200',
    label: 'Expired',
  },
  CANCELLED: {
    pill: 'bg-gray-100 text-gray-600 ring-gray-200/70',
    bar: 'bg-gray-300',
    chip: 'from-gray-400 to-gray-500 ring-gray-200',
    label: 'Cancelled',
  },
};

const FALLBACK_STATUS = STATUS_META.CHECKED_OUT;
const statusMeta = (status: string) => STATUS_META[status] || FALLBACK_STATUS;

const STATUS_ORDER = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED'];

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];

const humanise = (value: string) =>
  value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const formatDateTime = (value: string) =>
  `${new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

export default function AdminVisitorsPage() {
  const router = useRouter();
  const [passes, setPasses] = useState<VisitorPassResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  // The pass detail (including its QR) opens in a dialog, so the list never
  // shifts height when someone opens a pass.
  const [selected, setSelected] = useState<VisitorPassResponse | null>(null);

  const fetchPasses = useCallback(async () => {
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : '';
      const data = await apiGet<VisitorPassResponse[]>(`/api/v1/visitors${params}`);
      setPasses(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router, filter]);

  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  // Keep an open dialog in sync after an action changes the pass.
  const refreshSelected = async (id: string) => {
    const fresh = await apiGet<VisitorPassResponse>(`/api/v1/visitors/${id}`).catch(() => null);
    if (fresh) setSelected(fresh);
  };

  const handleApprove = async (id: string) => {
    setError(''); setSuccess('');
    try {
      await apiPatch(`/api/v1/visitors/${id}`, { status: 'APPROVED' });
      setSuccess('Pass approved');
      await fetchPasses();
      await refreshSelected(id);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleCancel = async (id: string) => {
    setError(''); setSuccess('');
    try {
      await apiPost(`/api/v1/visitors/${id}/cancel`);
      setSuccess('Pass cancelled');
      await fetchPasses();
      await refreshSelected(id);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  // Sort: pending first, then by status order, then by createdAt desc
  const sortedPasses = [...passes].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    if (ai !== bi) return ai - bi;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const q = searchQuery.trim().toLowerCase();
  const filteredPasses = q
    ? sortedPasses.filter(
        (p) =>
          p.visitorName.toLowerCase().includes(q) ||
          p.visitorPhone.includes(q) ||
          p.unitNumber.toLowerCase().includes(q) ||
          p.residentName.toLowerCase().includes(q)
      )
    : sortedPasses;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading visitor passes...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: passes.length,
    pending: passes.filter((p) => p.status === 'PENDING').length,
    approved: passes.filter((p) => p.status === 'APPROVED').length,
    checkedIn: passes.filter((p) => p.status === 'CHECKED_IN').length,
  };

  const selectedMeta = selected ? statusMeta(selected.status) : FALLBACK_STATUS;

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/admin')}
            aria-label="Back to dashboard"
            className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Visitors</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Every pass residents created, and what the gate sees.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/guard')}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-accent-200 hover:bg-accent-50/50"
          >
            <Scan className="w-4 h-4" /> Open security gate
          </button>
        </div>

        {/* Banners */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <XCircle className="mt-0.5 w-4 h-4 flex-shrink-0 text-red-600" />
            <p className="flex-1 text-body-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <CheckCircle2 className="mt-0.5 w-4 h-4 flex-shrink-0 text-emerald-600" />
            <p className="flex-1 text-body-sm text-emerald-700">{success}</p>
            <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { icon: QrCode, label: 'Total passes', value: stats.total, color: 'text-accent-600', bg: 'bg-accent-50' },
            { icon: Clock, label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
            { icon: CheckCircle2, label: 'Approved', value: stats.approved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: User, label: 'Checked in', value: stats.checkedIn, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md"
            >
              <div className="mb-2.5 flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">{stat.label}</span>
              </div>
              <p className="text-display font-display text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by visitor name, phone, unit, or resident..."
              aria-label="Search visitor passes"
              className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Status</span>
            {FILTERS.map((s) => {
              const active = filter === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-body-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,1)]'
                      : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {s === 'ALL' ? 'All' : humanise(s)}
                  {active && <span className="text-[11px] font-semibold tabular-nums text-white/75">{passes.length}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Passes list */}
        {filteredPasses.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <QrCode className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">
              {q ? 'No passes match your search' : filter !== 'ALL' ? `No ${humanise(filter).toLowerCase()} passes` : 'No visitor passes yet'}
            </h3>
            <p className="mx-auto max-w-sm text-body-sm text-gray-500">
              {q
                ? `Nothing matched “${searchQuery.trim()}”. Try another name, phone or unit.`
                : filter !== 'ALL'
                  ? 'Try another status filter to see the rest of the queue.'
                  : 'Residents create passes when they expect a visitor, and they show up here for approval.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPasses.map((p) => {
              const meta = statusMeta(p.status);
              return (
                // A div (not a button) because the card holds its own action
                // buttons - nesting interactive elements inside a button is invalid.
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(p);
                    }
                  }}
                  className="group relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-gray-200/80 bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-4 py-5 pl-6 pr-5">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.chip} ring-1 transition-transform duration-300 group-hover:scale-110`}>
                      <User className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="truncate text-title-sm font-display text-gray-900 transition-colors duration-200 group-hover:text-accent-700">
                          {p.visitorName}
                        </h3>
                        <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.pill}`}>
                          {meta.label}
                        </span>
                        {p.purpose && (
                          <span className="inline-flex flex-shrink-0 items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200/70">
                            {p.purpose}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {p.visitorPhone}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          Unit {p.unitNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <User className="w-3 h-3 text-gray-400" />
                          {p.residentName}
                        </span>
                        {p.vehicleNumber && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                            <Car className="w-3 h-3 text-gray-400" />
                            {p.vehicleNumber}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <CalendarDays className="w-3 h-3 text-gray-400" />
                          {formatDateTime(p.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelected(p)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-body-sm font-medium text-accent-700 transition-all hover:border-accent-300 hover:bg-accent-100"
                      >
                        <QrCode className="w-3.5 h-3.5" /> Details
                      </button>
                      {p.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-body-sm font-medium text-white transition-all hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleCancel(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {(p.status === 'APPROVED' || p.status === 'CHECKED_IN') && (
                        <button
                          onClick={() => handleCancel(p.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                      <ChevronRight className="hidden w-4 h-4 flex-shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent-600 sm:block" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Pass detail ─────────────────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        icon={User}
        title={selected?.visitorName || 'Visitor pass'}
        subtitle={selected ? `Unit ${selected.unitNumber} · hosted by ${selected.residentName}` : undefined}
        size="md"
      >
        {selected && (
          <div className="space-y-5">
            {/* Status row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${selectedMeta.pill}`}>
                {selectedMeta.label}
              </span>
              {selected.approvedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200/70">
                  <CheckCircle2 className="w-3 h-3" /> Approved {formatDateTime(selected.approvedAt)}
                </span>
              )}
              {selected.expiresAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200/70">
                  <Clock className="w-3 h-3" /> Expires {formatDateTime(selected.expiresAt)}
                </span>
              )}
            </div>

            {/* QR + token */}
            <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="rounded-xl bg-white p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-gray-200/70">
                <QRCodeSVG value={selected.qrToken} size={132} level="M" includeMargin />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Gate token</p>
                <p className="mt-1 break-all font-mono text-caption-xs text-gray-700">{selected.qrToken}</p>
                <p className="mt-2 text-caption-xs text-gray-400">
                  The guard scans this at the gate to check the visitor in or out.
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 px-4">
              {[
                { icon: Phone, label: 'Phone', value: selected.visitorPhone },
                ...(selected.visitorEmail ? [{ icon: Mail, label: 'Email', value: selected.visitorEmail }] : []),
                ...(selected.purpose ? [{ icon: FileText, label: 'Purpose', value: selected.purpose }] : []),
                ...(selected.vehicleNumber ? [{ icon: Car, label: 'Vehicle', value: selected.vehicleNumber }] : []),
                { icon: Building2, label: 'Unit', value: selected.unitNumber },
                { icon: User, label: 'Hosted by', value: selected.residentName },
                { icon: CalendarDays, label: 'Created', value: formatDateTime(selected.createdAt) },
                ...(selected.expectedArrival ? [{ icon: Clock, label: 'Expected arrival', value: formatDateTime(selected.expectedArrival) }] : []),
                ...(selected.expectedDeparture ? [{ icon: Clock, label: 'Expected departure', value: formatDateTime(selected.expectedDeparture) }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="inline-flex items-center gap-2 text-caption-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    <row.icon className="w-3.5 h-3.5" />
                    {row.label}
                  </span>
                  <span className="text-right text-body-sm font-medium text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-1">
              {selected.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleApprove(selected.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve pass
                  </button>
                  <button
                    onClick={() => handleCancel(selected.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </>
              )}
              {(selected.status === 'APPROVED' || selected.status === 'CHECKED_IN') && (
                <button
                  onClick={() => handleCancel(selected.id)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <XCircle className="w-4 h-4" /> Cancel pass
                </button>
              )}
              <button
                onClick={() => setSelected(null)}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
