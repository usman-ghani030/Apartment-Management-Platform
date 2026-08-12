'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Banknote, CreditCard, AlertCircle, CheckCircle, Clock, XCircle, ShieldAlert, RefreshCw } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { InvoiceResponse } from '@apartment/shared';

type Banner =
  | { kind: 'success'; text: string; invoiceId: string | null }
  | { kind: 'canceled'; text: string; invoiceId: string | null }
  | { kind: 'checking'; text: string; invoiceId: string | null }
  | null;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-700',
  ISSUED: 'bg-blue-500/10 text-blue-400',
  PAID: 'bg-green-500/10 text-green-400',
  OVERDUE: 'bg-red-500/10 text-red-400',
  CANCELLED: 'bg-gray-500/10 text-gray-700',
  DISPUTED: 'bg-yellow-500/10 text-yellow-400',
};

// Amounts are stored in paisa (rupees × 100) — format as Pakistani Rupees.
const formatRs = (paisa: number) => `Rs. ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ResidentInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const verifiedInvoice = useRef<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await apiGet<InvoiceResponse[]>('/api/v1/invoices');
      setInvoices(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  // Reconcile after returning from the Safepay hosted checkout: the webhook is
  // the source of truth, so we ask the gateway directly before trusting the redirect.
  const verifyPayment = useCallback(async (invoiceId: string) => {
    try {
      const result = await apiPost<{ status: string }>(`/api/v1/invoices/${invoiceId}/verify-payment`);
      if (result.status === 'succeeded') {
        setBanner({ kind: 'success', text: 'Payment received — thank you! Your invoice is now marked as paid.', invoiceId });
      } else if (result.status === 'failed') {
        setBanner({ kind: 'canceled', text: 'Your payment was not completed. No charge was made — you can try again.', invoiceId });
      } else {
        setBanner({ kind: 'checking', text: 'We are confirming your payment with the bank. This can take a few seconds — check again shortly.', invoiceId });
      }
      fetchInvoices();
    } catch {
      // Verification failed — keep the pending banner so the user can retry manually.
      setBanner({ kind: 'checking', text: 'We could not confirm the payment yet. Use “Check payment status” below to retry.', invoiceId });
    }
  }, [fetchInvoices]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Read redirect query params (?success=1 / ?canceled=1 &invoice=<id>) once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('invoice');
    if (params.get('success') === '1') {
      setBanner({ kind: 'success', text: 'Payment completed! Your invoice is being updated…', invoiceId });
      // Clean the URL so refresh doesn't replay the banner.
      window.history.replaceState({}, '', window.location.pathname);
      if (invoiceId && verifiedInvoice.current !== invoiceId) {
        verifiedInvoice.current = invoiceId;
        const t = setTimeout(() => verifyPayment(invoiceId), 2500);
        return () => clearTimeout(t);
      }
      if (!invoiceId) {
        // No invoice reference in the redirect — just refresh the list shortly.
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
      const result = await apiPost<{ url?: string; message?: string }>(`/api/v1/invoices/${id}/pay`);
      if (result.url) {
        window.location.href = result.url; // Redirect to the payment gateway
      } else {
        // Offline mode — just refresh
        fetchInvoices();
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleDispute = async (id: string) => {
    if (!disputeReason.trim()) return;
    try {
      setError('');
      await apiPost(`/api/v1/invoices/${id}/dispute`, { reason: disputeReason });
      setDisputingId(null);
      setDisputeReason('');
      fetchInvoices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const totalDue = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'OVERDUE').reduce((sum, i) => sum + i.amount, 0);

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/resident')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <div><h1 className="text-2xl font-bold text-gray-900">Invoices & Payments</h1><p className="text-gray-700 text-sm">View and pay your dues</p></div>
        </div>

        {/* Summary */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 border border-gray-200 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Total Outstanding</p>
              <p className="text-3xl font-bold">{formatRs(totalDue)}</p>
            </div>
            <div className="w-14 h-14 bg-accent-50 rounded-2xl flex items-center justify-center">
              <Banknote className="w-7 h-7 text-accent-600" />
            </div>
          </div>
        </div>

        {banner && (
          <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 mb-6 text-sm ${
            banner.kind === 'success' ? 'bg-green-500/10 border-green-500/25 text-green-700'
            : banner.kind === 'canceled' ? 'bg-amber-500/10 border-amber-500/25 text-amber-700'
            : 'bg-blue-500/10 border-blue-500/25 text-blue-700'
          }`}>
            {banner.kind === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : banner.kind === 'canceled' ? <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <div className="flex-1">{banner.text}</div>
            {banner.kind === 'checking' && banner.invoiceId && (
              <button
                onClick={() => verifyPayment(banner.invoiceId!)}
                className="flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Check payment status
              </button>
            )}
          </div>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        {invoices.length === 0 ? (
          <div className="text-center py-20"><Banknote className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No invoices</p><p className="text-gray-700 text-sm mt-1">Your society hasn't issued any invoices yet</p></div>
        ) : (
          <div className="space-y-4">
            {invoices.map((inv) => (
              <div key={inv.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[inv.status] || ''}`}>{inv.status}</span>
                      <span className="text-[10px] text-gray-700 font-mono">{inv.invoiceNumber}</span>
                    </div>
                    <h3 className="font-medium text-sm">{inv.title}</h3>
                    <p className="text-xs text-gray-700 mt-0.5">Unit {inv.unitNumber} · Due {new Date(inv.dueDate).toLocaleDateString()}{inv.periodStart && inv.periodEnd ? ` · ${new Date(inv.periodStart).toLocaleDateString()} - ${new Date(inv.periodEnd).toLocaleDateString()}` : ''}</p>
                    {inv.description && <p className="text-xs text-gray-700 mt-1">{inv.description}</p>}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold">{formatRs(inv.amount)}</p>
                  </div>
                </div>
                {/* Actions */}
                {(inv.status === 'ISSUED' || inv.status === 'OVERDUE') && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                    <button onClick={() => handlePay(inv.id)} className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 transition-all">
                      <CreditCard className="w-3 h-3" /> Pay Now
                    </button>
                    <button onClick={() => setDisputingId(disputingId === inv.id ? null : inv.id)} className="flex items-center gap-1 text-xs bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg px-3 py-1.5 transition-all">
                      <ShieldAlert className="w-3 h-3" /> Dispute
                    </button>
                  </div>
                )}
                {inv.status === 'DISPUTED' && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Under review — admin will resolve</p>
                  </div>
                )}
                {inv.status === 'PAID' && inv.paidAt && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Paid {new Date(inv.paidAt).toLocaleDateString()}</p>
                  </div>
                )}
                {/* Dispute form */}
                {disputingId === inv.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Why are you disputing this charge?" rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 mb-2 resize-y" />
                    <button onClick={() => handleDispute(inv.id)} className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg px-3 py-1.5 transition-all">Submit Dispute</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
