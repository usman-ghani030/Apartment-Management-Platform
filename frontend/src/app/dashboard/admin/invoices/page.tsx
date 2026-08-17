'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CreditCard, Banknote, Receipt, BellRing, RefreshCw } from 'lucide-react';
import { ApiError, apiGet, apiPost, apiPatch } from '@/lib/api';
import type { InvoiceResponse } from '@apartment/shared';

interface PaymentHistoryItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceTitle: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  provider?: string;
  providerSessionId?: string | null;
  providerTxnRef?: string | null;
}

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

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<{ id: string; unitNumber: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsErr, setSettingsErr] = useState('');
  const [runningReminders, setRunningReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState('');

  // Dues-reminder settings (Phase 7: how many days before due to remind)
  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiGet<{ dueReminderDays: number }>('/api/v1/settings');
      setReminderDays(data?.dueReminderDays ?? 3);
    } catch {
      // Best-effort — the card shows the default window if settings can't load.
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async () => {
    setSettingsMsg(''); setSettingsErr('');
    try {
      const data = await apiPatch<{ dueReminderDays: number }>('/api/v1/settings', { dueReminderDays: reminderDays });
      setSettingsMsg(`Saved — reminders go out ${data.dueReminderDays} day(s) before the due date.`);
    } catch (err) {
      if (err instanceof ApiError) setSettingsErr(err.message);
    }
  };

  const runReminders = async () => {
    setRunningReminders(true); setReminderResult(''); setSettingsErr('');
    try {
      const result = await apiPost<{ reminded: number }>('/api/v1/settings/run-reminders');
      setReminderResult(result.reminded > 0
        ? `Sent ${result.reminded} reminder(s) for invoices coming due.`
        : 'No reminders needed right now — nothing unpaid is due within the window.');
    } catch (err) {
      if (err instanceof ApiError) setSettingsErr(err.message);
    } finally {
      setRunningReminders(false);
    }
  };

  const fetchPayments = useCallback(async () => {
    try {
      const data = await apiGet<PaymentHistoryItem[]>('/api/v1/invoices/payments/history');
      setPayments(data || []);
    } catch {
      // Reconciliation view is best-effort — never block the main page on it.
    } finally { setPaymentsLoading(false); }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const fetchInvoices = useCallback(async () => {
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : '';
      const data = await apiGet<InvoiceResponse[]>(`/api/v1/invoices${params}`);
      setInvoices(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router, filter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const unitsData = await apiGet<{ id: string; unitNumber: string }[]>('/api/v1/units');
        setUnits(unitsData || []);
      } catch (err) {
        console.error('Failed to fetch units:', err);
      }
    };
    fetchUnits();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      await apiPost('/api/v1/invoices', { unitId, title, description, amount: amountCents, dueDate: new Date(dueDate).toISOString() });
      setTitle(''); setDescription(''); setAmount(''); setDueDate(''); setUnitId('');
      setShowForm(false); fetchInvoices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
            <div><h1 className="text-2xl font-bold text-gray-900">Invoices</h1><p className="text-gray-700 text-sm">Manage dues and payments</p></div>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Plus className="w-4 h-4" /> New Invoice</button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5 mb-6 overflow-x-auto">
          {['ALL', 'ISSUED', 'PAID', 'OVERDUE', 'DISPUTED', 'DRAFT', 'CANCELLED'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`text-xs px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${filter === s ? 'bg-accent-600 text-white' : 'text-gray-700 hover:text-gray-900'}`}>{s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}</button>
          ))}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        {/* Automated dues reminders — window setting + manual trigger */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <BellRing className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-gray-900">Automated dues reminders</h2>
                <p className="text-xs text-gray-700 mt-0.5">Residents get a reminder this many days before an invoice is due. The daily job sends them automatically.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={1}
                max={30}
                value={reminderDays}
                onChange={(e) => setReminderDays(Number(e.target.value))}
                aria-label="Reminder days before due"
                className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50"
              />
              <span className="text-xs text-gray-700">days before due</span>
              <button onClick={saveSettings} disabled={settingsLoading} className="bg-accent-600 hover:bg-accent-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50">Save</button>
              <button onClick={runReminders} disabled={runningReminders} className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2 font-medium transition-all disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${runningReminders ? 'animate-spin' : ''}`} /> {runningReminders ? 'Sending…' : 'Send reminders now'}
              </button>
            </div>
          </div>
          {settingsMsg && <p className="text-xs text-green-600 mt-3">{settingsMsg}</p>}
          {settingsErr && <p className="text-xs text-red-500 mt-3">{settingsErr}</p>}
          {reminderResult && <p className="text-xs text-gray-700 mt-3">{reminderResult}</p>}
        </div>

        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold mb-4">Create Invoice</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50">
                  <option value="">Select unit...</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Maintenance Dues - August 2024" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 resize-y" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50 [color-scheme:light]" />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="bg-accent-600 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition-all">{submitting ? 'Creating...' : 'Create Invoice'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-700 hover:text-gray-900 px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {invoices.length === 0 ? (
          <div className="text-center py-20"><Banknote className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No invoices yet</p><p className="text-gray-700 text-sm mt-1">Create your first invoice to get started</p></div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[inv.status] || ''}`}>{inv.status}</span>
                      <span className="text-[10px] text-gray-700 font-mono">{inv.invoiceNumber}</span>
                    </div>
                    <h3 className="font-medium text-sm">{inv.title}</h3>
                    <p className="text-xs text-gray-700 mt-0.5">Unit {inv.unitNumber} · Due {new Date(inv.dueDate).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold">{formatRs(inv.amount)}</p>
                    {inv.paidAmount && inv.paidAmount > 0 ? (
                      <p className="text-xs text-green-400">Paid {formatRs(inv.paidAmount)}</p>
                    ) : (
                      <p className="text-xs text-gray-700">{inv.status === 'OVERDUE' ? 'Overdue' : 'Unpaid'}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment history — reconciliation view (which invoices were paid via Safepay) */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-accent-600" />
            <h2 className="text-lg font-semibold text-gray-900">Payment history</h2>
            <span className="text-xs text-gray-700">Reconcile online payments against invoices</span>
          </div>
          {paymentsLoading ? (
            <div className="text-center py-8 text-gray-700 text-sm">Loading payments…</div>
          ) : payments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-700">No payments recorded yet</p>
              <p className="text-gray-700 text-sm mt-1">Payments appear here once residents pay their dues</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-700">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Invoice</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Method</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{p.invoiceTitle}</div>
                          <div className="text-xs text-gray-700 font-mono">{p.invoiceNumber}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{formatRs(p.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.provider === 'safepay' ? 'bg-blue-500/10 text-blue-700' : 'bg-gray-500/10 text-gray-700'}`}>
                            {p.provider === 'safepay' ? 'Safepay' : 'Offline'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{p.providerTxnRef || p.providerSessionId || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            p.status === 'succeeded' ? 'bg-green-500/10 text-green-700'
                            : p.status === 'failed' ? 'bg-red-500/10 text-red-700'
                            : 'bg-amber-500/10 text-amber-700'
                          }`}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
