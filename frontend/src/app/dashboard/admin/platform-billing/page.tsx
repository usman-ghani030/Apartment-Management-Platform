'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CreditCard, Landmark, Flag, Play, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw, Building2, Home, Receipt, Sparkles,
} from 'lucide-react';
import { platformBilling, ApiError } from '@/lib/api';
import type {
  PlatformInvoiceResponse,
  PlatformCustomQuoteFlagResponse,
  PlatformBillingRunResult,
  PlatformOverdueResult,
  PlatformInvoiceStatus,
  PlatformBillingStatus,
} from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Platform Billing (Phase 9, ADR 006) - societies paying the PLATFORM.
// Separate from resident dues (Invoices page, Phase 2 / Safepay).
//
// Two surfaces, deliberately in one page:
// - Every Committee Admin sees their OWN society's invoice history (read-only;
//   there is no self-service "mark paid" - payment happens by bank transfer).
// - A caller holding a SUPER_ADMIN membership additionally gets the platform-ops
//   panels (all societies, custom-quote flags, run controls, mark-as-paid).
//   Ops actions fail with 403 server-side regardless of what the UI shows.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<PlatformInvoiceStatus, { pill: string; bar: string; chip: string; dot: string }> = {
  PENDING: {
    pill: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    bar: 'bg-amber-400',
    chip: 'from-amber-400 to-amber-500 ring-amber-200',
    dot: 'bg-amber-400',
  },
  PAID: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    bar: 'bg-emerald-500',
    chip: 'from-emerald-500 to-emerald-600 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  OVERDUE: {
    pill: 'bg-red-50 text-red-700 ring-red-200/70',
    bar: 'bg-red-500',
    chip: 'from-red-500 to-red-600 ring-red-200',
    dot: 'bg-red-500',
  },
};

const FALLBACK_STATUS = STATUS_META.PENDING;
const statusMeta = (status: PlatformInvoiceStatus) => STATUS_META[status] || FALLBACK_STATUS;

const statusLabel = (status: PlatformInvoiceStatus) =>
  status.charAt(0) + status.slice(1).toLowerCase();

const formatRs = (rupees: number) =>
  `Rs ${rupees.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

const formatPeriod = (period: string) => {
  const [y, m] = period.split('-');
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long' });
  return `${month} ${y}`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

/** Expandable progressive-calculation breakdown - transparency per ADR 006. */
function Breakdown({ invoice }: { invoice: PlatformInvoiceResponse }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg text-caption font-medium text-accent-700 transition-colors hover:text-accent-800"
      >
        How this total was calculated ({invoice.unitCountSnapshot} units)
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/70">
          <table className="w-full text-caption">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-gray-400">
                <th className="px-4 py-2.5 font-semibold">Units</th>
                <th className="px-4 py-2.5 font-semibold">Rate / unit</th>
                <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.breakdown.map((b) => (
                <tr key={b.label} className="border-t border-gray-200/70">
                  <td className="px-4 py-2 text-gray-700">{b.label}</td>
                  <td className="px-4 py-2 tabular-nums text-gray-700">
                    {b.ratePerUnit === 0 ? 'Free' : `Rs ${b.ratePerUnit}`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900">{formatRs(b.subtotal)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 bg-white">
                <td className="px-4 py-2.5 font-semibold text-gray-900" colSpan={2}>Total / month</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                  {formatRs(invoice.totalAmountRupees)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-gray-200/70 px-4 py-3 text-caption-xs text-gray-500">
            Progressive pricing: the first 15 units are free, then each band&rsquo;s units are charged
            at that band&rsquo;s rate, like income tax brackets.
          </p>
        </div>
      )}
    </div>
  );
}

function InvoiceCard({
  invoice,
  showSociety,
  onMarkPaid,
  markingPaid,
}: {
  invoice: PlatformInvoiceResponse;
  showSociety: boolean;
  onMarkPaid?: (id: string) => void;
  markingPaid?: boolean;
}) {
  const meta = statusMeta(invoice.status);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]">
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`}
        aria-hidden="true"
      />

      <div className="px-5 py-5 pl-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.chip} ring-1 transition-transform duration-300 group-hover:scale-105`}>
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-title-sm font-display text-gray-900">{formatPeriod(invoice.billingPeriod)}</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.pill}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {statusLabel(invoice.status)}
                </span>
              </div>
              {showSociety && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-body-sm text-gray-600">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {invoice.societyName}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                  <Home className="w-3 h-3 text-gray-400" />
                  {invoice.unitCountSnapshot} units at generation
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                  Due {formatDate(invoice.dueDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end">
            <p className="text-display-sm font-display tabular-nums text-gray-900">
              {formatRs(invoice.totalAmountRupees)}
            </p>
            <p className="text-caption-xs text-gray-400">per month</p>
            {invoice.paidAt && (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-caption-xs font-medium text-emerald-700 ring-1 ring-emerald-200/70">
                <CheckCircle2 className="w-3 h-3" />
                Paid {formatDate(invoice.paidAt)}
                {invoice.markedPaidBySuperAdminName ? `, confirmed by ${invoice.markedPaidBySuperAdminName}` : ''}
              </p>
            )}
          </div>
        </div>

        <Breakdown invoice={invoice} />

        {onMarkPaid && invoice.status !== 'PAID' && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => onMarkPaid(invoice.id)}
              disabled={markingPaid}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {markingPaid ? 'Marking...' : 'Mark as paid'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small label + hairline used to head each block on the page. */
function SectionHeader({
  icon: Icon,
  title,
  hint,
  tone = 'text-gray-400',
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Icon className={`h-4 w-4 flex-shrink-0 ${tone}`} />
      <h2 className="text-title-sm font-display text-gray-900">{title}</h2>
      <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
      {hint && <span className="text-caption-xs text-gray-400">{hint}</span>}
    </div>
  );
}

export default function PlatformBillingPage() {
  const [myInvoices, setMyInvoices] = useState<PlatformInvoiceResponse[]>([]);
  const [allInvoices, setAllInvoices] = useState<PlatformInvoiceResponse[] | null>(null);
  const [quoteFlags, setQuoteFlags] = useState<PlatformCustomQuoteFlagResponse[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [status, setStatus] = useState<PlatformBillingStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opsMsg, setOpsMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, st] = await Promise.all([
        platformBilling.listMine(),
        platformBilling.getStatus().catch(() => null),
      ]);
      setMyInvoices(mine || []);
      setStatus(st);

      // Ops surfaces are probed, not assumed: the server 403s non-super-admins.
      try {
        const all = await platformBilling.listAll();
        setAllInvoices(all || []);
        setQuoteFlags((await platformBilling.listCustomQuotes()) || []);
        setIsSuperAdmin(true);
      } catch {
        setAllInvoices(null);
        setIsSuperAdmin(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load platform billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runGeneration = async (dryRun: boolean) => {
    setBusy(true);
    setOpsMsg('');
    try {
      const result: PlatformBillingRunResult = await platformBilling.runGeneration(dryRun);
      setOpsMsg(
        `${result.dryRun ? 'DRY RUN - nothing was written. ' : ''}` +
          `Societies scanned: ${result.scannedSocieties}, invoices ${result.dryRun ? 'would be created' : 'created'}: ${result.created}, ` +
          `free-tier skipped: ${result.skippedFree}, already existing: ${result.skippedExisting}, ` +
          `custom-quote flags: ${result.customQuoteFlags}` +
          (result.errors.length ? `, errors: ${result.errors.join('; ')}` : '')
      );
      if (!dryRun) await load();
    } catch (err) {
      setOpsMsg(err instanceof ApiError ? err.message : 'Run failed');
    } finally {
      setBusy(false);
    }
  };

  const runOverdueCheck = async () => {
    setBusy(true);
    setOpsMsg('');
    try {
      const result: PlatformOverdueResult = await platformBilling.runOverdueCheck();
      setOpsMsg(
        `Overdue check complete - scanned: ${result.scanned}, marked overdue: ${result.markedOverdue}, ` +
          `reminder emails sent: ${result.remindersSent}` +
          (result.errors.length ? `, errors: ${result.errors.join('; ')}` : '')
      );
      await load();
    } catch (err) {
      setOpsMsg(err instanceof ApiError ? err.message : 'Run failed');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (id: string) => {
    setMarkingPaidId(id);
    setOpsMsg('');
    try {
      await platformBilling.markPaid(id);
      setOpsMsg('Invoice marked as paid.');
      await load();
    } catch (err) {
      setOpsMsg(err instanceof ApiError ? err.message : 'Failed to mark paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const unpaidCount = myInvoices.filter((i) => i.status !== 'PAID').length;
  const overdueCount = myInvoices.filter((i) => i.status === 'OVERDUE').length;
  const paidCount = myInvoices.filter((i) => i.status === 'PAID').length;

  const billingState = status?.isFreeTier
    ? { label: 'Free tier', tone: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' }
    : status?.isCustomQuote
      ? { label: 'Custom quote', tone: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-400' }
      : { label: 'Billable', tone: 'text-accent-600', bg: 'bg-accent-50', bar: 'bg-accent-500' };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Platform billing</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              OmniHome&rsquo;s monthly fee for your society. Separate from resident dues.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="flex-1 text-body-sm text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200/80 bg-white p-14">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
            <p className="text-body-sm text-gray-500">Loading platform billing...</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            {status && (
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${billingState.bar}`} aria-hidden="true" />
                  <div className="mb-2 flex items-center gap-2.5 pl-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${billingState.bg}`}>
                      <Sparkles className={`h-4 w-4 ${billingState.tone}`} />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Status</span>
                  </div>
                  <p className={`pl-2 text-title-sm font-display ${billingState.tone}`}>{billingState.label}</p>
                </div>

                <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50">
                      <Home className="h-4 w-4 text-accent-600" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Active units</span>
                  </div>
                  <p className="text-display font-display tabular-nums text-gray-900">{status.unitCount}</p>
                </div>

                <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                      <Receipt className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Unpaid</span>
                  </div>
                  <p className="text-display font-display tabular-nums text-gray-900">{unpaidCount}</p>
                </div>

                <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Paid</span>
                  </div>
                  <p className="text-display font-display tabular-nums text-gray-900">{paidCount}</p>
                </div>
              </div>
            )}

            {/* Where the society stands today: free tier / custom quote / billable */}
            {status && status.isFreeTier && (
              <div className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-6">
                <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" aria-hidden="true" />
                <div className="flex items-start gap-3.5 pl-2">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 ring-1 ring-emerald-200">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-title font-display text-gray-900">You&rsquo;re on the free tier</h2>
                    <p className="mt-1.5 text-body-sm text-gray-600">
                      Your society has <strong className="font-semibold text-gray-900">{status.unitCount} active unit{status.unitCount === 1 ? '' : 's'}</strong> and
                      the first <strong className="font-semibold text-gray-900">{status.freeUnitThreshold}</strong> are always free, so
                      OmniHome costs you nothing right now and every feature is included. No invoices, nothing to pay.
                    </p>
                    <p className="mt-3 rounded-xl bg-white/70 px-3.5 py-3 text-caption text-gray-500 ring-1 ring-emerald-100">
                      If your society grows past {status.freeUnitThreshold} units, billing starts automatically from the next
                      month. Units {status.freeUnitThreshold + 1} to 50 cost Rs 20 each, and the rate per unit drops as you
                      grow. You&rsquo;ll see it here first, with the full calculation shown.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status && status.isCustomQuote && (
              <div className="relative mb-6 overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-6">
                <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400" aria-hidden="true" />
                <div className="flex items-start gap-3.5 pl-2">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 ring-1 ring-amber-200">
                    <Flag className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-title font-display text-gray-900">Custom pricing for your society</h2>
                    <p className="mt-1.5 text-body-sm text-gray-600">
                      With <strong className="font-semibold text-gray-900">{status.unitCount} units</strong>, your society is larger
                      than the standard auto-billing cap ({status.autoInvoiceCap} units). Our team will reach out to agree a
                      custom quote. Until then you won&rsquo;t be auto-invoiced.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status && !status.isFreeTier && !status.isCustomQuote && (
              <div className="relative mb-6 overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-6">
                <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-accent-500" aria-hidden="true" />
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pl-2">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200">
                      <CreditCard className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
                        Estimated fee today
                      </p>
                      <p className="mt-1 text-display-sm font-display tabular-nums text-gray-900">
                        {formatRs(status.estimatedTotalRupees)}
                        <span className="ml-1.5 text-body-sm font-normal text-gray-400">/month</span>
                      </p>
                      <p className="mt-1 text-caption text-gray-500">
                        Based on {status.unitCount} active units at progressive rates. Confirmed invoices appear below
                        once generated each month.
                      </p>
                    </div>
                  </div>
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-caption-xs font-semibold text-red-700 ring-1 ring-red-200/70">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {overdueCount} overdue invoice{overdueCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Payment instructions - hidden on the free tier: there is nothing to pay. */}
            {status && !status.isFreeTier && !status.isCustomQuote && (
              <div className="mb-8">
                <SectionHeader icon={Landmark} title="How to pay" hint="Bank transfer" tone="text-accent-600" />
                <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <p className="text-body-sm text-gray-600">
                    Pay by bank transfer using the details below. The platform team then confirms your invoice as
                    paid, usually within one business day of receiving the transfer.
                  </p>
                  <div className="mt-4 rounded-xl border border-dashed border-accent-300 bg-accent-50/50 px-4 py-3.5 font-mono text-caption text-gray-700">
                    [BANK DETAILS PLACEHOLDER - TO BE PROVIDED]
                  </div>
                  <p className="mt-3 text-caption text-gray-500">
                    Transfer reference: your society name plus the billing period, for example
                    &ldquo;Sunrise Apartments 2026-09&rdquo;.
                  </p>
                </div>
              </div>
            )}

            {/* Own society's invoices */}
            <SectionHeader
              icon={Receipt}
              title="Your society's invoices"
              hint={unpaidCount > 0 ? `${unpaidCount} unpaid` : 'All settled'}
              tone="text-gray-400"
            />
            {myInvoices.length === 0 ? (
              <div className="mb-8 rounded-2xl border border-gray-200/80 bg-white p-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
                  <Receipt className="h-6 w-6 text-accent-500" />
                </div>
                <h3 className="mb-1.5 text-title-sm font-display text-gray-900">No invoices yet</h3>
                <p className="mx-auto max-w-md text-body-sm text-gray-500">
                  {status?.isFreeTier
                    ? `Nothing to pay. ${status.unitCount} of your ${status.freeUnitThreshold} free units are in use.`
                    : 'Your platform invoices will appear here once they are generated each month.'}
                </p>
              </div>
            ) : (
              <div className="mb-10 space-y-3">
                {myInvoices.map((inv) => (
                  <InvoiceCard key={inv.id} invoice={inv} showSociety={false} />
                ))}
              </div>
            )}

            {/* Platform-ops panels (SUPER_ADMIN membership only) */}
            {isSuperAdmin && (
              <section className="mt-12 border-t border-gray-200 pt-8">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900">
                    <Flag className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-title font-display text-gray-900">Platform operations</h2>
                    <p className="text-body-sm text-gray-500">
                      Super Admin only. All societies&rsquo; platform invoices and run controls.
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                    Super Admin
                  </span>
                </div>

                {/* Run controls */}
                <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <h3 className="mb-1 text-title-sm font-display text-gray-900">Billing runs</h3>
                  <p className="mb-4 text-caption text-gray-500">
                    Always dry-run first: it reports exactly which invoices would be created, and for how much,
                    without writing anything.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => runGeneration(true)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-accent-300 bg-accent-50 px-4 py-2.5 text-body-sm font-medium text-accent-700 transition-all hover:bg-accent-100 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      Dry run
                    </button>
                    <button
                      type="button"
                      onClick={() => runGeneration(false)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      Generate for this month
                    </button>
                    <button
                      type="button"
                      onClick={runOverdueCheck}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Run overdue check
                    </button>
                  </div>
                  {opsMsg && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      <p className="flex-1 break-words text-caption text-gray-600">{opsMsg}</p>
                    </div>
                  )}
                </div>

                {/* Custom-quote flags (501+ units) */}
                <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                      <Flag className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-title-sm font-display text-gray-900">Custom quotes needed</h3>
                      <p className="text-caption-xs text-gray-400">Societies with 501+ units, outside the auto-invoice cap</p>
                    </div>
                  </div>
                  {quoteFlags.length === 0 ? (
                    <div className="rounded-xl bg-gray-50 px-4 py-3.5 text-body-sm text-gray-500">
                      None. Every society is within the auto-invoice cap.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {quoteFlags.map((f) => (
                        <li
                          key={f.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3"
                        >
                          <span className="text-body-sm font-semibold text-gray-900">{f.societyName}</span>
                          <span className="rounded-md bg-white px-2 py-0.5 text-caption-xs text-gray-500 ring-1 ring-amber-100">
                            {f.unitCountSnapshot} units
                          </span>
                          <span className="text-caption-xs text-gray-500">flagged for {formatPeriod(f.billingPeriod)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* All societies' invoices */}
                <SectionHeader
                  icon={Building2}
                  title="All societies' invoices"
                  hint={allInvoices ? `${(allInvoices ?? []).length} total` : undefined}
                />
                {(allInvoices ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
                      <Building2 className="h-6 w-6 text-accent-500" />
                    </div>
                    <h3 className="mb-1.5 text-title-sm font-display text-gray-900">No platform invoices yet</h3>
                    <p className="text-body-sm text-gray-500">Run a generation first, then they will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(allInvoices ?? []).map((inv) => (
                      <InvoiceCard
                        key={inv.id}
                        invoice={inv}
                        showSociety
                        onMarkPaid={markPaid}
                        markingPaid={markingPaidId === inv.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
