'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CreditCard, Landmark, Flag, Play, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw,
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
// Platform Billing (Phase 9, ADR 006) — societies paying the PLATFORM.
// Separate from resident dues (Invoices page, Phase 2 / Safepay).
//
// Two surfaces, deliberately in one page:
// - Every Committee Admin sees their OWN society's invoice history (read-only;
//   there is no self-service "mark paid" — payment happens by bank transfer).
// - A caller holding a SUPER_ADMIN membership additionally gets the platform-ops
//   panels (all societies, custom-quote flags, run controls, mark-as-paid).
//   Ops actions fail with 403 server-side regardless of what the UI shows.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<PlatformInvoiceStatus, string> = {
  PENDING: 'bg-status-warning/10 text-status-warning',
  PAID: 'bg-status-success/10 text-status-success',
  OVERDUE: 'bg-status-danger/10 text-status-danger',
};

const formatRs = (rupees: number) =>
  `Rs ${rupees.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

const formatPeriod = (period: string) => {
  const [y, m] = period.split('-');
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long' });
  return `${month} ${y}`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

/** Expandable progressive-calculation breakdown — transparency per ADR 006. */
function Breakdown({ invoice }: { invoice: PlatformInvoiceResponse }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-caption text-accent-700 hover:text-accent-800 font-medium"
        aria-expanded={open}
      >
        How this total was calculated ({invoice.unitCountSnapshot} units)
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 p-3 text-caption">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-700">
                <th className="py-1 font-semibold">Units</th>
                <th className="py-1 font-semibold">Rate / unit</th>
                <th className="py-1 font-semibold text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.breakdown.map((b) => (
                <tr key={b.label} className="border-t border-gray-200">
                  <td className="py-1 text-gray-900">{b.label}</td>
                  <td className="py-1 text-gray-900">
                    {b.ratePerUnit === 0 ? 'Free' : `Rs ${b.ratePerUnit}`}
                  </td>
                  <td className="py-1 text-right text-gray-900">{formatRs(b.subtotal)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 font-semibold">
                <td className="py-1 text-gray-900" colSpan={2}>Total / month</td>
                <td className="py-1 text-right text-gray-900">{formatRs(invoice.totalAmountRupees)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-gray-700">
            Progressive pricing: the first 15 units are free, then each band&rsquo;s units are charged
            at that band&rsquo;s rate — like income tax brackets.
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
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-title-sm text-gray-900">{formatPeriod(invoice.billingPeriod)}</h3>
            <span className={`text-caption-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[invoice.status]}`}>
              {invoice.status}
            </span>
          </div>
          {showSociety && (
            <p className="text-body-sm text-gray-700 mt-0.5">{invoice.societyName}</p>
          )}
          <p className="text-caption text-gray-700 mt-0.5">
            {invoice.unitCountSnapshot} units at generation · due {formatDate(invoice.dueDate)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-display-sm text-gray-900">{formatRs(invoice.totalAmountRupees)}</p>
          {invoice.paidAt && (
            <p className="text-caption text-status-success">
              Paid {formatDate(invoice.paidAt)}
              {invoice.markedPaidBySuperAdminName ? ` · confirmed by ${invoice.markedPaidBySuperAdminName}` : ''}
            </p>
          )}
        </div>
      </div>

      <Breakdown invoice={invoice} />

      {onMarkPaid && invoice.status !== 'PAID' && (
        <button
          type="button"
          onClick={() => onMarkPaid(invoice.id)}
          disabled={markingPaid}
          className="mt-3 inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-body-sm font-medium transition-all"
        >
          <CheckCircle2 className="w-4 h-4" />
          {markingPaid ? 'Marking…' : 'Mark as paid'}
        </button>
      )}
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
        `${result.dryRun ? 'DRY RUN — nothing was written. ' : ''}` +
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
        `Overdue check complete — scanned: ${result.scanned}, marked overdue: ${result.markedOverdue}, ` +
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

  return (
    <div className="px-4 py-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-4.5 h-4.5 text-accent-600" />
        </div>
        <div>
          <h1 className="text-display-sm text-gray-900">Platform billing</h1>
          <p className="text-body-sm text-gray-700">
            OmniHome platform fee for your society — separate from resident dues.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-status-danger/10 border border-status-danger/20 text-status-danger text-body-sm rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-body-sm text-gray-700">
          Loading…
        </div>
      ) : (
        <>
          {/* Where the society stands today — free tier / custom quote / billable */}
          {status && status.isFreeTier && (
            <div className="bg-status-success/5 border border-status-success/20 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4.5 h-4.5 text-status-success" />
                <h2 className="text-title-sm text-gray-900">You&rsquo;re on the free tier 🎉</h2>
              </div>
              <p className="text-body-sm text-gray-700">
                Your society has <strong>{status.unitCount} active unit{status.unitCount === 1 ? '' : 's'}</strong> and
                the first <strong>{status.freeUnitThreshold}</strong> are always free — so OmniHome costs you
                nothing right now, and every feature is included. No invoices, nothing to pay.
              </p>
              <p className="text-caption text-gray-700 mt-1">
                If your society grows past {status.freeUnitThreshold} units, billing starts automatically from the
                next month — units {status.freeUnitThreshold + 1}–50 cost Rs 20 each, and the rate per unit drops as
                you grow. You&rsquo;ll see it here first, with the full calculation shown.
              </p>
            </div>
          )}

          {status && status.isCustomQuote && (
            <div className="bg-status-info/5 border border-status-info/20 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4.5 h-4.5 text-status-info" />
                <h2 className="text-title-sm text-gray-900">Custom pricing for your society</h2>
              </div>
              <p className="text-body-sm text-gray-700">
                With <strong>{status.unitCount} units</strong>, your society is larger than the standard
                auto-billing cap ({status.autoInvoiceCap} units). Our team will reach out to agree a custom
                quote — until then you won&rsquo;t be auto-invoiced.
              </p>
            </div>
          )}

          {status && !status.isFreeTier && !status.isCustomQuote && (
            <div className="bg-accent-50/60 border border-accent-200 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Play className="w-4 h-4 text-accent-700" />
                <h2 className="text-title-sm text-gray-900">
                  Estimated fee today: {formatRs(status.estimatedTotalRupees)}/month
                </h2>
              </div>
              <p className="text-caption text-gray-700">
                Based on {status.unitCount} active units (progressive rates). Confirmed invoices appear below
                once generated each month.
              </p>
            </div>
          )}

          {/* Payment instructions (manual bank transfer until auto-billing, ADR 006) —
              hidden on the free tier: there is nothing to pay. */}
          {status && !status.isFreeTier && !status.isCustomQuote && (
          <div className="bg-accent-50/60 border border-accent-200 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="w-4 h-4 text-accent-700" />
              <h2 className="text-title-sm text-gray-900">How to pay</h2>
            </div>
            <p className="text-body-sm text-gray-700">
              Pay by bank transfer using the details below, then the platform team confirms your
              invoice as paid — usually within one business day of receiving the transfer.
            </p>
            <div className="mt-3 rounded-lg border border-dashed border-accent-300 bg-white/60 p-3 text-caption text-gray-700 font-mono">
              [BANK DETAILS PLACEHOLDER — TO BE PROVIDED]
            </div>
            <p className="text-caption text-gray-700 mt-2">
              Bank transfer reference: your society name + the billing period (e.g.
              &ldquo;Sunrise Apartments 2026-09&rdquo;).
            </p>
          </div>
          )}

          {/* Own society's invoices */}
          <h2 className="text-title-sm text-gray-900 mb-3">
            Your society&rsquo;s invoices
            {unpaidCount > 0 && (
              <span className="ml-2 text-caption-xs font-medium px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning align-middle">
                {unpaidCount} unpaid
              </span>
            )}
          </h2>
          {myInvoices.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-body-sm text-gray-700 mb-6">
              {status?.isFreeTier
                ? `Nothing to pay — ${status.unitCount} of your ${status.freeUnitThreshold} free units are in use.`
                : 'No platform invoices yet.'}
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {myInvoices.map((inv) => (
                <InvoiceCard key={inv.id} invoice={inv} showSociety={false} />
              ))}
            </div>
          )}

          {/* ── Platform-ops panels (SUPER_ADMIN membership only) ── */}
          {isSuperAdmin && (
            <section className="mt-10 pt-8 border-t border-gray-200">
              <h2 className="text-title-sm text-gray-900 mb-1">Platform operations</h2>
              <p className="text-body-sm text-gray-700 mb-4">
                Super Admin only — all societies&rsquo; platform invoices and run controls.
              </p>

              {/* Run controls */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-4">
                <h3 className="text-body font-semibold text-gray-900 mb-3">Billing runs</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runGeneration(true)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 border border-accent-600 text-accent-700 hover:bg-accent-50 disabled:opacity-50 rounded-lg px-4 py-2 text-body-sm font-medium transition-all"
                  >
                    <Play className="w-4 h-4" />
                    Dry run
                  </button>
                  <button
                    type="button"
                    onClick={() => runGeneration(false)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-body-sm font-medium transition-all"
                  >
                    <Play className="w-4 h-4" />
                    Generate for this month
                  </button>
                  <button
                    type="button"
                    onClick={runOverdueCheck}
                    disabled={busy}
                    className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 rounded-lg px-4 py-2 text-body-sm font-medium transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Run overdue check
                  </button>
                </div>
                {opsMsg && (
                  <p className="mt-3 text-caption text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-words">
                    {opsMsg}
                  </p>
                )}
                <p className="mt-3 text-caption text-gray-700">
                  Always dry-run first: it reports exactly which invoices would be created (and for
                  how much) without writing anything.
                </p>
              </div>

              {/* Custom-quote flags (501+ units) */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flag className="w-4 h-4 text-status-warning" />
                  <h3 className="text-body font-semibold text-gray-900">
                    Societies needing a custom quote (501+ units)
                  </h3>
                </div>
                {quoteFlags.length === 0 ? (
                  <p className="text-body-sm text-gray-700">None — all societies are within the auto-invoice cap.</p>
                ) : (
                  <ul className="space-y-2">
                    {quoteFlags.map((f) => (
                      <li key={f.id} className="rounded-lg bg-status-warning/5 border border-status-warning/20 px-3 py-2 text-body-sm text-gray-900">
                        <span className="font-semibold">{f.societyName}</span> — {f.unitCountSnapshot} units, flagged for {formatPeriod(f.billingPeriod)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* All societies' invoices */}
              <div className="space-y-3">
                <h3 className="text-body font-semibold text-gray-900">All societies&rsquo; invoices</h3>
                {(allInvoices ?? []).length === 0 ? (
                  <p className="text-body-sm text-gray-700">No platform invoices exist yet — run a generation first.</p>
                ) : (
                  (allInvoices ?? []).map((inv) => (
                    <InvoiceCard
                      key={inv.id}
                      invoice={inv}
                      showSociety
                      onMarkPaid={markPaid}
                      markingPaid={markingPaidId === inv.id}
                    />
                  ))
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
