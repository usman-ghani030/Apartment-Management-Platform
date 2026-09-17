'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, AlertCircle, BadgeCheck, Check, X, Clock, XCircle,
  FileText, Home, User, Hash, Landmark, ImageOff, Loader2, ArrowDown,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Panel, PanelEmpty } from '@/components/ui/Panel';
import { FilterPills } from '@/components/ui/SearchField';
import { Modal, fieldInput, fieldLabel } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { API_BASE, ApiError, apiGetPage, apiPost, getAuthToken } from '@/lib/api';
import { PAYMENT_METHOD_LABELS } from '@apartment/shared';
import type { PaymentProofResponse, PaymentMethod } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Manual payment proofs (ADR 008) - admin review queue.
//
// Residents upload a screenshot of an off-platform payment; this is where an
// admin approves (invoice becomes paid) or rejects (with a reason the resident
// sees). A claimed amount that differs from what the invoice asks for is flagged
// on the card - it is the admin's call, never auto-adjusted.
// ─────────────────────────────────────────────────────────────────────────────

const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const;
type Filter = (typeof FILTERS)[number];

const formatRs = (paisa: number) =>
  `Rs. ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

const STATUS_META: Record<string, { label: string; badge: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  PENDING: { label: 'Awaiting review', badge: 'warning' },
  APPROVED: { label: 'Approved', badge: 'success' },
  REJECTED: { label: 'Rejected', badge: 'danger' },
};

/**
 * Screenshots are served from an authenticated endpoint, so a plain <img src>
 * cannot load them (auth is a header token, not a cookie). Fetch the bytes with
 * the token and hand the card a blob URL instead.
 */
function useProofImage(proofId: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/api/v1/payment-proofs/${proofId}/screenshot`, {
          credentials: 'include',
          headers: token ? { 'x-access-token': token } : {},
        });
        if (!res.ok) return;
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setUrl(objectUrl);
      } catch {
        // Leave the placeholder in place - a missing thumbnail is not fatal here.
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proofId]);

  return url;
}

function ProofThumbnail({ proof, onOpen }: { proof: PaymentProofResponse; onOpen: () => void }) {
  const url = useProofImage(proof.id);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View payment screenshot for ${proof.invoiceNumber}`}
      className="group relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50"
    >
      {url ? (
        <>
          <img
            src={url}
            alt={`Payment screenshot for ${proof.invoiceNumber}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-x-0 bottom-0 bg-gray-900/70 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            View full size
          </span>
        </>
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
          <ImageOff className="h-4 w-4" />
          <span className="text-[10px]">Loading...</span>
        </span>
      )}
    </button>
  );
}

export default function AdminPaymentProofsPage() {
  const router = useRouter();
  const [proofs, setProofs] = useState<PaymentProofResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PaymentProofResponse | null>(null);
  const [reason, setReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);
  const [lightbox, setLightbox] = useState<PaymentProofResponse | null>(null);

  const fetchPage = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ status: filter, limit: '20' });
    if (cursor) params.set('cursor', cursor);
    return apiGetPage<PaymentProofResponse>(`/api/v1/payment-proofs?${params.toString()}`);
  }, [filter]);

  const load = useCallback(async () => {
    try {
      setError('');
      const page = await fetchPage();
      setProofs(page.data);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
      else if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, router]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextCursor);
      setProofs((prev) => [...prev, ...page.data]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const approve = async (proof: PaymentProofResponse) => {
    setBusyId(proof.id);
    setError('');
    setNotice('');
    try {
      await apiPost(`/api/v1/payment-proofs/${proof.id}/approve`);
      setNotice(
        `Approved ${formatRs(proof.claimedAmount)} for ${proof.residentName}. The invoice is now marked paid.`
      );
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejecting || reason.trim().length < 3) return;
    setSubmittingReject(true);
    setError('');
    setNotice('');
    try {
      await apiPost(`/api/v1/payment-proofs/${rejecting.id}/reject`, {
        rejectionReason: reason.trim(),
      });
      setNotice(`Rejected the proof from ${rejecting.residentName}. They can submit a new one.`);
      setRejecting(null);
      setReason('');
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmittingReject(false);
    }
  };

  const mismatches = useMemo(() => proofs.filter((p) => p.amountMismatch).length, [proofs]);

  if (loading) return <PageSkeleton width="max-w-6xl" />;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/admin')}
          aria-label="Back to dashboard"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-display-sm font-display text-gray-900">Payment proofs</h1>
            <p className="text-body-sm text-gray-500">
              Screenshots residents uploaded for payments made outside the app - verify before the invoice is marked paid
            </p>
          </div>
        </div>
      </div>

      {notice && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <p className="flex-1 text-body-sm text-emerald-700">{notice}</p>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="flex-1 text-body-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <FilterPills
          value={filter}
          onChange={(key) => setFilter(key as Filter)}
          options={FILTERS.map((f) => ({
            key: f,
            label: f === 'ALL' ? 'All' : STATUS_META[f].label,
          }))}
        />
        <p className="mt-3 text-caption-xs text-gray-500">
          {proofs.length === 0
            ? 'Nothing in this view.'
            : `${proofs.length} proof${proofs.length === 1 ? '' : 's'} in view${mismatches > 0 ? ` - ${mismatches} with an amount that does not match the invoice` : ''}`}
        </p>
      </div>

      {proofs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <PanelEmpty
            icon={BadgeCheck}
            title={filter === 'PENDING' ? 'Nothing waiting for you' : 'Nothing here'}
            description={
              filter === 'PENDING'
                ? 'When a resident uploads proof of an off-platform payment, it lands here for verification.'
                : 'No payment proofs match this filter.'
            }
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {proofs.map((proof) => {
            const meta = STATUS_META[proof.status] || STATUS_META.PENDING;
            const pending = proof.status === 'PENDING';
            const method = PAYMENT_METHOD_LABELS[proof.paymentMethod as PaymentMethod] || proof.paymentMethod;

            return (
              <li
                key={proof.id}
                className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
              >
                <span
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    pending ? (proof.amountMismatch ? 'bg-amber-400' : 'bg-accent-500') : meta.badge === 'success' ? 'bg-emerald-500' : 'bg-red-400'
                  }`}
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-start gap-5 py-4 pl-6 pr-5">
                  <ProofThumbnail proof={proof} onOpen={() => setLightbox(proof)} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
                      {proof.amountMismatch && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                          <AlertCircle className="h-3 w-3" /> Amount mismatch
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 font-mono text-[11px] text-gray-500 ring-1 ring-gray-200/70">
                        <FileText className="h-3 w-3" /> {proof.invoiceNumber}
                      </span>
                    </div>

                    <h3 className="mt-2.5 truncate text-body font-semibold text-gray-900">
                      {proof.invoiceTitle}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption-xs text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-gray-400" /> {proof.residentName}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5 text-gray-400" /> Unit {proof.unitNumber || 'N/A'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Landmark className="h-3.5 w-3.5 text-gray-400" /> {method}
                      </span>
                      {proof.transactionReference && (
                        <span className="inline-flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-gray-400" /> {proof.transactionReference}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-gray-400" /> {formatDateTime(proof.createdAt)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Claimed</p>
                        <p
                          className={`mt-0.5 text-body font-semibold tabular-nums ${
                            proof.amountMismatch ? 'text-amber-700' : 'text-gray-900'
                          }`}
                        >
                          {formatRs(proof.claimedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Invoice asks for</p>
                        <p className="mt-0.5 text-body font-semibold tabular-nums text-gray-900">
                          {formatRs(proof.invoiceOutstandingAmount)}
                        </p>
                      </div>
                      {proof.amountMismatch && (
                        <p className="max-w-md self-end text-caption-xs text-amber-700">
                          The claimed amount differs from what this invoice asks for. Approving pays
                          the invoice as fully settled either way - reject if that is not what happened.
                        </p>
                      )}
                    </div>

                    {!pending && (
                      <p className="mt-3 text-caption-xs text-gray-500">
                        {proof.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                        {proof.reviewedByName ? ` by ${proof.reviewedByName}` : ''}
                        {proof.reviewedAt ? ` on ${formatDateTime(proof.reviewedAt)}` : ''}
                        {proof.rejectionReason ? ` - "${proof.rejectionReason}"` : ''}
                      </p>
                    )}
                  </div>

                  {pending && (
                    <div className="flex flex-shrink-0 flex-col gap-2 sm:w-44">
                      <button
                        onClick={() => approve(proof)}
                        disabled={busyId === proof.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-body-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {busyId === proof.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Approve &amp; mark paid
                      </button>
                      <button
                        onClick={() => { setRejecting(proof); setReason(''); }}
                        disabled={busyId === proof.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-body-sm font-medium text-red-700 transition-all hover:bg-red-50 disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:bg-gray-50 disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDown className="h-3.5 w-3.5" />}
            Load more
          </button>
        </div>
      )}

      {proofs.length > 0 && (
        <Panel
          icon={Landmark}
          title="What approving does"
          hint="Same end state as a gateway payment"
          className="mt-6"
        >
          <p className="px-5 py-4 text-body-sm leading-relaxed text-gray-600">
            Approving records the claimed amount as a payment, marks the invoice paid, stops any
            future dues reminder for it, and shows up in the dues collection figures on Analytics -
            the same as a Safepay payment. Rejecting changes nothing on the invoice and sends the
            resident your reason so they can upload a corrected proof.
          </p>
        </Panel>
      )}

      {/* Reject dialog - a reason is always required */}
      <Modal
        open={!!rejecting}
        onClose={() => { setRejecting(null); setReason(''); }}
        title="Reject this payment proof"
        subtitle={rejecting ? `${rejecting.residentName} · Unit ${rejecting.unitNumber} · ${rejecting.invoiceNumber}` : undefined}
        icon={XCircle}
        size="sm"
        footer={
          <>
            <button
              onClick={submitReject}
              disabled={reason.trim().length < 3 || submittingReject}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-body-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50"
            >
              {submittingReject ? 'Rejecting...' : 'Reject proof'}
            </button>
            <button
              onClick={() => { setRejecting(null); setReason(''); }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
          </>
        }
      >
        <label className={fieldLabel} htmlFor="rejection-reason">
          Why is it being rejected?
        </label>
        <textarea
          id="rejection-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="e.g. the screenshot is unreadable, or the amount does not match the transfer"
          className={`${fieldInput} resize-y`}
        />
        <p className="mt-1.5 text-caption-xs text-gray-500">
          The resident sees this on their invoice and can upload a corrected proof.
        </p>
      </Modal>

      {/* Full-size screenshot */}
      <Modal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        title={lightbox ? `Proof for ${lightbox.invoiceNumber}` : 'Proof'}
        subtitle={lightbox ? `${lightbox.residentName} · Unit ${lightbox.unitNumber} · claimed ${formatRs(lightbox.claimedAmount)}` : undefined}
        icon={BadgeCheck}
        size="lg"
      >
        {lightbox && <LightboxImage proofId={lightbox.id} />}
      </Modal>
    </div>
  );
}

/** Full-size screenshot inside the lightbox modal (authenticated blob fetch). */
function LightboxImage({ proofId }: { proofId: string }) {
  const url = useProofImage(proofId);
  if (!url) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-body-sm">Loading screenshot...</p>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="Payment screenshot"
      className="max-h-[70vh] w-full rounded-xl border border-gray-200 bg-gray-50 object-contain"
    />
  );
}
