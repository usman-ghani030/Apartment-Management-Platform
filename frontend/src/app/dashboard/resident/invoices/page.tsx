'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Banknote, CreditCard, AlertCircle, Check, Clock, XCircle,
  ShieldAlert, RefreshCw, CalendarDays, FileText, Home, X, Receipt,
  Upload, Hourglass, Image as ImageIcon,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatTile, StatTileGrid } from '@/components/ui/StatTile';
import { Panel, CountPill, PanelEmpty } from '@/components/ui/Panel';
import { SearchField, FilterPills } from '@/components/ui/SearchField';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useSignedUpload } from '@/lib/useSignedUpload';
import { PAYMENT_METHOD_LABELS, PaymentMethodValues } from '@apartment/shared';
import type { InvoiceResponse, PaymentMethod } from '@apartment/shared';

type Banner =
  | { kind: 'success'; text: string; invoiceId: string | null }
  | { kind: 'canceled'; text: string; invoiceId: string | null }
  | { kind: 'checking'; text: string; invoiceId: string | null }
  | null;

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_META: Record<string, { label: string; badge: BadgeVariant; rail: string }> = {
  DRAFT: { label: 'Draft', badge: 'neutral', rail: 'bg-gray-300' },
  ISSUED: { label: 'Issued', badge: 'info', rail: 'bg-accent-500' },
  PAID: { label: 'Paid', badge: 'success', rail: 'bg-emerald-500' },
  OVERDUE: { label: 'Overdue', badge: 'danger', rail: 'bg-red-500' },
  CANCELLED: { label: 'Cancelled', badge: 'neutral', rail: 'bg-gray-300' },
  DISPUTED: { label: 'Disputed', badge: 'warning', rail: 'bg-amber-400' },
};

const metaFor = (status: string) =>
  STATUS_META[status] || { label: status, badge: 'neutral' as BadgeVariant, rail: 'bg-gray-300' };

// Amounts are stored in paisa (rupees x 100) - format as Pakistani Rupees.
const formatRs = (paisa: number) =>
  `Rs. ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function ResidentInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const verifiedInvoice = useRef<string | null>(null);

  // Manual payment proof (ADR 008): the invoice whose upload form is open, plus
  // its draft. Amounts are entered in rupees and converted to paisa on submit.
  const [proofInvoiceId, setProofInvoiceId] = useState<string | null>(null);
  const [proofAmount, setProofAmount] = useState('');
  const [proofMethod, setProofMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [proofReference, setProofReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofError, setProofError] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);

  const { upload: uploadScreenshot, uploading: uploadingScreenshot, progress: screenshotProgress } =
    useSignedUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await apiGet<InvoiceResponse[]>('/api/v1/invoices');
      setInvoices(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Reconcile after returning from the Safepay hosted checkout: the webhook is
  // the source of truth, so we ask the gateway directly before trusting the redirect.
  const verifyPayment = useCallback(async (invoiceId: string) => {
    try {
      const result = await apiPost<{ status: string }>(`/api/v1/invoices/${invoiceId}/verify-payment`);
      if (result.status === 'succeeded') {
        setBanner({ kind: 'success', text: 'Payment received - thank you! Your invoice is now marked as paid.', invoiceId });
      } else if (result.status === 'failed') {
        setBanner({ kind: 'canceled', text: 'Your payment was not completed. No charge was made - you can try again.', invoiceId });
      } else {
        setBanner({ kind: 'checking', text: 'We are confirming your payment with the bank. This can take a few seconds - check again shortly.', invoiceId });
      }
      fetchInvoices();
    } catch {
      // Verification failed - keep the pending banner so the user can retry manually.
      setBanner({ kind: 'checking', text: 'We could not confirm the payment yet. Use "Check payment status" below to retry.', invoiceId });
    }
  }, [fetchInvoices]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Read redirect query params (?success=1 / ?canceled=1 &invoice=<id>) once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('invoice');
    if (params.get('success') === '1') {
      setBanner({ kind: 'success', text: 'Payment completed! Your invoice is being updated.', invoiceId });
      // Clean the URL so refresh doesn't replay the banner.
      window.history.replaceState({}, '', window.location.pathname);
      if (invoiceId && verifiedInvoice.current !== invoiceId) {
        verifiedInvoice.current = invoiceId;
        const t = setTimeout(() => verifyPayment(invoiceId), 2500);
        return () => clearTimeout(t);
      }
      if (!invoiceId) {
        // No invoice reference in the redirect - just refresh the list shortly.
        const t = setTimeout(() => fetchInvoices(), 2500);
        return () => clearTimeout(t);
      }
    } else if (params.get('canceled') === '1') {
      setBanner({ kind: 'canceled', text: 'Payment was canceled. You can try again whenever you are ready.', invoiceId });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [verifyPayment, fetchInvoices]);

  const handlePay = async (id: string) => {
    try {
      setError('');
      setPayingId(id);
      const result = await apiPost<{ url?: string; message?: string }>(`/api/v1/invoices/${id}/pay`);
      if (result.url) {
        window.location.href = result.url; // Redirect to the payment gateway
      } else {
        // Offline mode - just refresh
        fetchInvoices();
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setPayingId(null);
    }
  };

  // ── Manual payment proof helpers ─────────────────────────────────────────
  /** 'pending' / 'rejected' proof state for an invoice, or null when there is none. */
  const proofState = (inv: InvoiceResponse) => {
    const proof = inv.paymentProof;
    if (!proof || proof.status === 'APPROVED') return null;
    return proof.status === 'PENDING'
      ? ({ kind: 'pending', proof } as const)
      : ({ kind: 'rejected', proof } as const);
  };

  const resetProofForm = () => {
    setProofInvoiceId(null);
    setProofAmount('');
    setProofMethod('BANK_TRANSFER');
    setProofReference('');
    setProofFile(null);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
    setProofError('');
  };

  const openProofForm = (inv: InvoiceResponse) => {
    setProofInvoiceId(inv.id);
    setProofAmount((inv.amount / 100).toFixed(2));
    setProofMethod('BANK_TRANSFER');
    setProofReference('');
    setProofFile(null);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
    setProofError('');
    setDisputingId(null);
  };

  const handleProofFile = (file: File | null) => {
    setProofFile(file);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(file ? URL.createObjectURL(file) : null);
    setProofError('');
  };

  const submitProof = async (inv: InvoiceResponse) => {
    const rupees = Number(proofAmount);
    if (!proofFile) {
      setProofError('Attach a screenshot of the payment.');
      return;
    }
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setProofError('Enter the amount you paid.');
      return;
    }

    setSubmittingProof(true);
    try {
      // The screenshot goes straight to Cloudinary (ADR 002) against this
      // invoice's folder; the proof then references it by public id.
      const asset = await uploadScreenshot(proofFile, 'payment-proof', inv.id);

      await apiPost(`/api/v1/invoices/${inv.id}/payment-proof`, {
        publicId: asset.publicId,
        // Server expects integer paisa, the same unit invoices are stored in.
        claimedAmount: Math.round(rupees * 100),
        paymentMethod: proofMethod,
        transactionReference: proofReference.trim() || null,
      });
      resetProofForm();
      setBanner({
        kind: 'checking',
        text: 'Payment proof submitted. Your committee will verify it and your invoice will update once approved.',
        invoiceId: inv.id,
      });
      fetchInvoices();
    } catch (err) {
      if (err instanceof ApiError) setProofError(err.message);
      else setProofError('We could not submit that proof. Please try again.');
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleDispute = async (id: string) => {
    if (!disputeReason.trim()) return;
    setSubmittingDispute(true);
    try {
      setError('');
      await apiPost(`/api/v1/invoices/${id}/dispute`, { reason: disputeReason });
      setDisputingId(null);
      setDisputeReason('');
      fetchInvoices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const unpaid = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'OVERDUE');
  const overdue = invoices.filter((i) => i.status === 'OVERDUE');
  const paid = invoices.filter((i) => i.status === 'PAID');
  const totalDue = unpaid.reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = overdue.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = paid.reduce((sum, i) => sum + (i.paidAmount ?? i.amount), 0);

  // Earliest unpaid invoice - what the summary card offers to settle first.
  const nextDue = [...unpaid].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  // Whole days between now and the due date (negative = overdue).
  const daysUntilDue = (dueDate: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - now.getTime()) / 86400000);
  };

  const awaitingProof = invoices.filter((i) => i.paymentProof?.status === 'PENDING');

  const q = search.trim().toLowerCase();
  const filtered = invoices.filter((inv) => {
    if (statusFilter === 'PENDING_PROOF') {
      if (inv.paymentProof?.status !== 'PENDING') return false;
    } else if (statusFilter === 'unpaid') {
      if (inv.status !== 'ISSUED' && inv.status !== 'OVERDUE') return false;
    } else if (statusFilter !== 'all' && inv.status !== statusFilter) {
      return false;
    }
    if (!q) return true;
    return [inv.title, inv.invoiceNumber, inv.status, inv.description || ''].some((v) => v.toLowerCase().includes(q));
  });

  const filtersActive = q.length > 0 || statusFilter !== 'all';

  if (loading) return <PageSkeleton width="max-w-5xl" />;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/resident')}
          aria-label="Back to dashboard"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
            <Banknote className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-display-sm font-display text-gray-900">Payments</h1>
            <p className="text-body-sm text-gray-500">Your dues, receipts and anything you have raised a query about</p>
          </div>
        </div>
      </div>

      {/* ── Outstanding summary ─────────────────────────────────────── */}
      {invoices.length > 0 && (
        <section className="relative mb-6 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" aria-hidden="true" />

          <div className="flex flex-wrap items-center gap-x-8 gap-y-5 px-6 py-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Total outstanding</p>
              <p className={`mt-2.5 text-display font-display tabular-nums leading-none ${totalDue > 0 ? 'text-gray-900' : 'text-emerald-600'}`}>
                {formatRs(totalDue)}
              </p>
              <p className="mt-2 text-caption-xs text-gray-500">
                {unpaid.length === 0
                  ? 'Nothing due. You are fully settled.'
                  : `${unpaid.length} unpaid invoice${unpaid.length === 1 ? '' : 's'}${totalOverdue > 0 ? ` · ${formatRs(totalOverdue)} overdue` : ''}`}
              </p>
            </div>

            {nextDue && (
              <div className="min-w-0 flex-1 rounded-2xl border border-gray-200/80 bg-gray-50/70 px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Next due</p>
                <p className="mt-1 truncate text-body-sm font-semibold text-gray-900">{nextDue.title}</p>
                <p className="mt-0.5 text-caption-xs text-gray-500">
                  {formatRs(nextDue.amount)} · due {shortDate(nextDue.dueDate)}
                </p>
              </div>
            )}

            {nextDue && (
              <button
                onClick={() => handlePay(nextDue.id)}
                disabled={payingId === nextDue.id}
                className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:-translate-y-0.5 hover:bg-accent-700 disabled:opacity-60"
              >
                <CreditCard className="h-4 w-4" />
                {payingId === nextDue.id ? 'Opening checkout...' : 'Pay now'}
              </button>
            )}
          </div>
        </section>
      )}

      {invoices.length > 0 && (
        <StatTileGrid className="mb-6">
          <StatTile icon={Receipt} label="Invoices" value={invoices.length} hint="All issued to your unit" />
          <StatTile
            icon={AlertCircle}
            label="Overdue"
            value={overdue.length}
            hint={overdue.length === 0 ? 'None overdue' : 'Past the due date'}
            tone={overdue.length > 0 ? 'danger' : 'accent'}
          />
          <StatTile icon={Check} label="Paid" value={paid.length} hint={paid.length === 0 ? 'Nothing paid yet' : 'Receipts kept below'} />
          <StatTile icon={Banknote} label="Paid total" value={formatRs(totalPaid)} hint="Across all receipts" />
        </StatTileGrid>
      )}

      {banner && (
        <div
          className={`mb-6 flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3.5 ${
            banner.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50'
              : banner.kind === 'canceled'
                ? 'border-amber-200 bg-amber-50'
                : 'border-accent-200 bg-accent-50'
          }`}
        >
          {banner.kind === 'success' ? (
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          ) : banner.kind === 'canceled' ? (
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          ) : (
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-600" />
          )}
          <p
            className={`min-w-0 flex-1 text-body-sm ${
              banner.kind === 'success' ? 'text-emerald-700' : banner.kind === 'canceled' ? 'text-amber-700' : 'text-accent-700'
            }`}
          >
            {banner.text}
          </p>
          {banner.kind === 'checking' && banner.invoiceId && (
            <button
              onClick={() => verifyPayment(banner.invoiceId!)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-accent-600 px-3 py-2 text-caption-xs font-semibold text-white transition-all hover:bg-accent-700"
            >
              <RefreshCw className="h-3 w-3" /> Check payment status
            </button>
          )}
          <button
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
            className="flex-shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <p className="flex-1 text-body-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {invoices.length > 0 && (
        <SearchField
          className="mb-6"
          value={search}
          onChange={setSearch}
          placeholder="Search by title, invoice number or status..."
          filters={
            <FilterPills
              value={statusFilter}
              onChange={setStatusFilter}
              onClear={filtersActive ? () => { setSearch(''); setStatusFilter('all'); } : undefined}
              options={[
                { key: 'all', label: 'All', count: invoices.length },
                { key: 'unpaid', label: 'Unpaid', count: unpaid.length },
                { key: 'PENDING_PROOF', label: 'Pending proof', count: awaitingProof.length },
                { key: 'OVERDUE', label: 'Overdue', count: overdue.length },
                { key: 'PAID', label: 'Paid', count: paid.length },
                { key: 'DISPUTED', label: 'Disputed', count: invoices.filter((i) => i.status === 'DISPUTED').length },
                { key: 'CANCELLED', label: 'Cancelled', count: invoices.filter((i) => i.status === 'CANCELLED').length },
              ]}
            />
          }
          hint={
            filtersActive
              ? `Showing ${filtered.length} of ${invoices.length} invoices`
              : `${invoices.length} invoice${invoices.length === 1 ? '' : 's'} · ${formatRs(totalDue)} outstanding`
          }
        />
      )}

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <PanelEmpty
            icon={Banknote}
            title="No invoices yet"
            description="Your society has not issued any dues to your unit. Anything raised will appear here with a Pay now button."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <PanelEmpty
            icon={FileText}
            title="Nothing matched that"
            description="No invoice matches your current search and filter."
            action={
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
              >
                <X className="h-4 w-4" /> Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((inv) => {
            const meta = metaFor(inv.status);
            const isUnpaid = inv.status === 'ISSUED' || inv.status === 'OVERDUE';
            const days = daysUntilDue(inv.dueDate);
            const canDispute = isUnpaid && inv.status !== 'DISPUTED';
            const proof = proofState(inv);
            const awaiting = proof?.kind === 'pending';
            return (
              <li
                key={inv.id}
                className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
              >
                <span
                  className={`absolute left-0 top-0 bottom-0 w-1 ${awaiting ? 'bg-amber-400' : meta.rail}`}
                  aria-hidden="true"
                />

                <div className="px-5 py-4 pl-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 font-mono text-[11px] text-gray-500 ring-1 ring-gray-200/70">
                          <FileText className="h-3 w-3" /> {inv.invoiceNumber}
                        </span>
                        {isUnpaid && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                              inv.status === 'OVERDUE' || days < 0
                                ? 'bg-red-50 text-red-700 ring-red-200'
                                : 'bg-amber-50 text-amber-700 ring-amber-200'
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {days < 0
                              ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
                              : days === 0
                                ? 'Due today'
                                : `Due in ${days} day${days === 1 ? '' : 's'}`}
                          </span>
                        )}
                        {/* A proof awaiting review is neither Unpaid nor Paid - it
                            gets its own state so the resident does not resubmit. */}
                        {awaiting && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                            <Hourglass className="h-3 w-3" /> Verification pending
                          </span>
                        )}
                        {proof?.kind === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                            <XCircle className="h-3 w-3" /> Proof rejected
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 truncate text-body font-semibold text-gray-900">{inv.title}</h3>
                      {inv.description && (
                        <p className="mt-1 line-clamp-2 text-body-sm leading-relaxed text-gray-500">{inv.description}</p>
                      )}

                      <div className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
                        <Field label="Unit">
                          <span className="inline-flex items-center gap-1.5">
                            <Home className="h-3.5 w-3.5 text-gray-400" /> {inv.unitNumber}
                          </span>
                        </Field>
                        <Field label="Due date">{shortDate(inv.dueDate)}</Field>
                        <Field
                          label="Billing period"
                          hint={inv.periodStart && inv.periodEnd ? undefined : 'One-off charge'}
                        >
                          {inv.periodStart && inv.periodEnd
                            ? `${shortDate(inv.periodStart)} - ${shortDate(inv.periodEnd)}`
                            : 'Not applicable'}
                        </Field>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Amount</p>
                      <p className="mt-1.5 text-title font-display tabular-nums text-gray-900">{formatRs(inv.amount)}</p>
                      {inv.paidAt && inv.paidAmount != null && (
                        <p className="mt-1 text-caption-xs text-emerald-600">Paid {formatRs(inv.paidAmount)}</p>
                      )}
                    </div>
                  </div>

                  {isUnpaid && !awaiting && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                      <button
                        onClick={() => handlePay(inv.id)}
                        disabled={payingId === inv.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:opacity-60"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        {payingId === inv.id ? 'Opening checkout...' : 'Pay now'}
                      </button>
                      {/* Second, independent path: paid off-platform (bank transfer,
                          Easypaisa, JazzCash, cash) - upload the receipt instead. */}
                      <button
                        onClick={() => (proofInvoiceId === inv.id ? resetProofForm() : openProofForm(inv))}
                        aria-expanded={proofInvoiceId === inv.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {proof?.kind === 'rejected' ? 'Resubmit payment proof' : 'Upload payment proof'}
                      </button>
                      {canDispute && (
                        <button
                          onClick={() => {
                            setDisputingId(disputingId === inv.id ? null : inv.id);
                            setDisputeReason('');
                            resetProofForm();
                          }}
                          aria-expanded={disputingId === inv.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" /> Raise a query
                        </button>
                      )}
                    </div>
                  )}

                  {awaiting && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <Hourglass className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                      <p className="text-body-sm text-amber-800">
                        We received your payment proof on {shortDate(proof!.proof.createdAt)}. Your
                        committee is verifying it - there is nothing more to do, and no need to pay
                        or submit again.
                      </p>
                    </div>
                  )}

                  {proof?.kind === 'rejected' && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                      <div className="min-w-0">
                        <p className="text-body-sm font-semibold text-red-800">
                          Your payment proof was not accepted
                        </p>
                        <p className="mt-0.5 text-body-sm text-red-700">
                          {proof.proof.rejectionReason ||
                            'Your committee could not verify this payment.'}
                        </p>
                        <p className="mt-1.5 text-caption-xs text-red-600">
                          {proof.proof.reviewedByName
                            ? `Reviewed by ${proof.proof.reviewedByName}`
                            : 'Reviewed'}
                          {proof.proof.reviewedAt ? ` on ${shortDate(proof.proof.reviewedAt)}` : ''}
                          {isUnpaid
                            ? ' - upload a corrected proof, or pay online, above.'
                            : '.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {inv.status === 'DISPUTED' && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                      <p className="text-body-sm text-amber-800">
                        You have queried this charge. Your committee will review it and get back to you.
                      </p>
                    </div>
                  )}

                  {inv.status === 'PAID' && inv.paidAt && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                      <p className="text-body-sm text-emerald-700">Paid on {shortDate(inv.paidAt)}. Thank you.</p>
                    </div>
                  )}

                  {/* Manual payment proof upload (ADR 008) */}
                  {proofInvoiceId === inv.id && (
                    <div className="mt-4 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-gray-900">
                            Upload proof of payment
                          </p>
                          <p className="mt-0.5 text-caption-xs text-gray-500">
                            Paid by bank transfer, Easypaisa, JazzCash or cash? Attach a screenshot
                            of the payment and your committee will verify it.
                          </p>
                        </div>
                        <button
                          onClick={resetProofForm}
                          aria-label="Cancel payment proof"
                          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <label
                        htmlFor={`proof-file-${inv.id}`}
                        className="mt-3.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 text-center transition-colors hover:border-accent-300 hover:bg-accent-50/40"
                      >
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                        <span className="max-w-full truncate text-body-sm font-medium text-gray-700">
                          {proofFile ? proofFile.name : 'Choose a screenshot'}
                        </span>
                        <span className="text-caption-xs text-gray-400">
                          {uploadingScreenshot
                            ? `Uploading… ${screenshotProgress}%`
                            : 'JPEG, PNG, WebP or GIF up to 10 MB'}
                        </span>
                        <input
                          id={`proof-file-${inv.id}`}
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="sr-only"
                          onChange={(e) => handleProofFile(e.target.files?.[0] ?? null)}
                        />
                      </label>

                      {proofPreview && (
                        <img
                          src={proofPreview}
                          alt="Payment screenshot preview"
                          className="mt-3 max-h-56 w-full rounded-xl border border-gray-200 bg-white object-contain"
                        />
                      )}

                      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <div>
                          <label
                            className="block text-body-sm font-medium text-gray-700"
                            htmlFor={`proof-amount-${inv.id}`}
                          >
                            Amount paid
                          </label>
                          <div className="relative mt-1.5">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-body-sm text-gray-400">
                              Rs.
                            </span>
                            <input
                              id={`proof-amount-${inv.id}`}
                              type="number"
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              value={proofAmount}
                              onChange={(e) => setProofAmount(e.target.value)}
                              className="w-full rounded-xl border border-gray-200/80 bg-white py-2.5 pl-11 pr-3.5 text-body-sm tabular-nums text-gray-900 transition-all focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                            />
                          </div>
                          <p className="mt-1.5 text-caption-xs text-gray-400">
                            Invoice asks for {formatRs(inv.amount)}. You can claim a different
                            amount - your committee will see the difference.
                          </p>
                        </div>

                        <div>
                          <label
                            className="block text-body-sm font-medium text-gray-700"
                            htmlFor={`proof-method-${inv.id}`}
                          >
                            How did you pay?
                          </label>
                          <Select
                            className="mt-1.5"
                            value={proofMethod}
                            onChange={(e) => setProofMethod(e.target.value as PaymentMethod)}
                          >
                            {PaymentMethodValues.map((m) => (
                              <option key={m} value={m}>
                                {PAYMENT_METHOD_LABELS[m]}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>

                      <div className="mt-3.5">
                        <label
                          className="block text-body-sm font-medium text-gray-700"
                          htmlFor={`proof-reference-${inv.id}`}
                        >
                          Reference (optional)
                        </label>
                        <input
                          id={`proof-reference-${inv.id}`}
                          value={proofReference}
                          onChange={(e) => setProofReference(e.target.value)}
                          maxLength={100}
                          placeholder="Transaction ID, cheque number..."
                          className="mt-1.5 w-full rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                        />
                      </div>

                      {proofError && (
                        <p className="mt-3 flex items-start gap-2 text-body-sm text-red-700">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {proofError}
                        </p>
                      )}

                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => submitProof(inv)}
                          disabled={submittingProof}
                          className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:opacity-60"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingScreenshot
                            ? `Uploading ${screenshotProgress}%`
                            : submittingProof
                              ? 'Submitting...'
                              : 'Submit for verification'}
                        </button>
                        <button
                          onClick={resetProofForm}
                          className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {disputingId === inv.id && (
                    <div className="mt-4 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4">
                      <label className="block text-body-sm font-medium text-gray-700" htmlFor={`dispute-${inv.id}`}>
                        What is wrong with this charge?
                      </label>
                      <textarea
                        id={`dispute-${inv.id}`}
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Explain the issue so your committee can look into it."
                        rows={3}
                        maxLength={1000}
                        className="mt-2 w-full resize-y rounded-xl border border-gray-200/80 bg-white px-4 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                      />
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleDispute(inv.id)}
                          disabled={!disputeReason.trim() || submittingDispute}
                          className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {submittingDispute ? 'Submitting...' : 'Submit query'}
                        </button>
                        <button
                          onClick={() => { setDisputingId(null); setDisputeReason(''); }}
                          className="rounded-xl border border-gray-200 px-3.5 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:bg-white hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {invoices.length > 0 && (
        <Panel
          icon={CalendarDays}
          title="How payments work"
          hint="What happens after you tap Pay now"
          className="mt-6"
        >
          <ol className="divide-y divide-gray-100">
            {[
              { step: '1', text: 'We open your bank or card checkout with the invoice amount already filled in.' },
              { step: '2', text: 'Once the bank confirms, this page reconciles the payment against the invoice automatically.' },
              { step: '3', text: 'Paid outside the app? Upload a screenshot with "Upload payment proof" and your committee verifies it - the invoice shows "Verification pending" until they do.' },
              { step: '4', text: 'If you raised a query instead, your committee reviews it and replies through the notice board.' },
            ].map((row) => (
              <li key={row.step} className="flex items-start gap-3.5 px-5 py-3.5">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-50 text-caption-xs font-bold text-accent-700 ring-1 ring-accent-100">
                  {row.step}
                </span>
                <p className="text-body-sm leading-relaxed text-gray-600">{row.text}</p>
              </li>
            ))}
          </ol>
          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3">
            <p className="text-caption-xs text-gray-500">
              Queries are for charges that look wrong. For payment plans or waivers, speak to your committee directly.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
