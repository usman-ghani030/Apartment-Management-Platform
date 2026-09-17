'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, CreditCard, Banknote, Receipt, BellRing, RefreshCw,
  CalendarClock, Trash2, X, CheckCircle2, AlertTriangle, Landmark, Clock,
  CalendarDays, Home, FileText, Save,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { ApiError, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
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

// Status drives the accent bar, chip and pill.
const STATUS_META: Record<string, { pill: string; bar: string; chip: string; label: string }> = {
  DRAFT: { pill: 'bg-gray-100 text-gray-600 ring-gray-200/70', bar: 'bg-gray-300', chip: 'from-gray-400 to-gray-500 ring-gray-200', label: 'Draft' },
  ISSUED: { pill: 'bg-accent-50 text-accent-700 ring-accent-200/70', bar: 'bg-accent-500', chip: 'from-accent-500 to-accent-600 ring-accent-200', label: 'Issued' },
  PAID: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70', bar: 'bg-emerald-500', chip: 'from-emerald-500 to-emerald-600 ring-emerald-200', label: 'Paid' },
  OVERDUE: { pill: 'bg-red-50 text-red-700 ring-red-200/70', bar: 'bg-red-500', chip: 'from-red-500 to-red-600 ring-red-200', label: 'Overdue' },
  CANCELLED: { pill: 'bg-gray-100 text-gray-500 ring-gray-200/70', bar: 'bg-gray-300', chip: 'from-gray-400 to-gray-500 ring-gray-200', label: 'Cancelled' },
  DISPUTED: { pill: 'bg-amber-50 text-amber-700 ring-amber-200/70', bar: 'bg-amber-500', chip: 'from-amber-500 to-amber-600 ring-amber-200', label: 'Disputed' },
};

const FALLBACK_STATUS = STATUS_META.ISSUED;
const statusMeta = (status: string) => STATUS_META[status] || FALLBACK_STATUS;

const FILTERS = ['ALL', 'ISSUED', 'PAID', 'OVERDUE', 'DISPUTED', 'DRAFT', 'CANCELLED'] as const;
type StatusFilter = (typeof FILTERS)[number];

// Amounts are stored in paisa (rupees × 100) - format as Pakistani Rupees.
const formatRs = (paisa: number) => `Rs. ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<{ id: string; unitNumber: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsErr, setSettingsErr] = useState('');
  const [runningReminders, setRunningReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState('');
  // Recurring billing settings
  const [billingDay, setBillingDay] = useState<number | null>(null);
  const [runningBilling, setRunningBilling] = useState(false);
  const [billingResult, setBillingResult] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dues-reminder settings (Phase 7: how many days before due to remind)
  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiGet<{ dueReminderDays: number; billingDayOfMonth: number | null }>('/api/v1/settings');
      setReminderDays(data?.dueReminderDays ?? 3);
      setBillingDay(data?.billingDayOfMonth ?? null);
    } catch {
      // Best-effort - the card shows the default window if settings can't load.
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async () => {
    setSettingsMsg(''); setSettingsErr('');
    try {
      const data = await apiPatch<{ dueReminderDays: number; billingDayOfMonth: number | null }>('/api/v1/settings', {
        dueReminderDays: reminderDays,
        billingDayOfMonth: billingDay,
      });
      setSettingsMsg(`Saved - reminders ${data.dueReminderDays} day(s) before due, billing day ${data.billingDayOfMonth ?? 'off'}`);
    } catch (err) {
      if (err instanceof ApiError) setSettingsErr(err.message);
    }
  };

  const runBilling = async () => {
    setRunningBilling(true); setBillingResult(''); setSettingsErr('');
    try {
      const result = await apiPost<{ created: number; skipped: number }>('/api/v1/settings/run-billing');
      setBillingResult(result.created > 0
        ? `Generated ${result.created} invoice(s), ${result.skipped} skipped (already exist).`
        : `No new invoices - ${result.skipped} already exist for this period.`);
    } catch (err) {
      if (err instanceof ApiError) setSettingsErr(err.message);
    } finally {
      setRunningBilling(false);
    }
  };

  const runReminders = async () => {
    setRunningReminders(true); setReminderResult(''); setSettingsErr('');
    try {
      const result = await apiPost<{ reminded: number }>('/api/v1/settings/run-reminders');
      setReminderResult(result.reminded > 0
        ? `Sent ${result.reminded} reminder(s) for invoices coming due.`
        : 'No reminders needed right now - nothing unpaid is due within the window.');
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
      // Reconciliation view is best-effort - never block the main page on it.
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

  const resetForm = () => {
    setTitle(''); setDescription(''); setAmount(''); setDueDate(''); setUnitId('');
    setShowForm(false); setError('');
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!window.confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await apiDelete(`/api/v1/invoices/${id}`);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      setSuccess(`Invoice ${invoiceNumber} deleted`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setDeletingId(null); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(''); setSuccess('');
    try {
      if (!unitId) { setError('Pick the unit this invoice is for'); setSubmitting(false); return; }
      // Client-side mirror of the server rule (amount is stored in paisa, must be > 0)
      const amountCents = Math.round(parseFloat(amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        setError('Enter an amount greater than zero');
        setSubmitting(false);
        return;
      }
      if (!dueDate) {
        setError('Pick a due date');
        setSubmitting(false);
        return;
      }
      await apiPost('/api/v1/invoices', { unitId, title, description, amount: amountCents, dueDate: new Date(dueDate).toISOString() });
      resetForm();
      setSuccess('Invoice created');
      fetchInvoices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading invoices...</p>
        </div>
      </div>
    );
  }

  const counts: Record<StatusFilter, number> = {
    ALL: invoices.length,
    ISSUED: invoices.filter((i) => i.status === 'ISSUED').length,
    PAID: invoices.filter((i) => i.status === 'PAID').length,
    OVERDUE: invoices.filter((i) => i.status === 'OVERDUE').length,
    DISPUTED: invoices.filter((i) => i.status === 'DISPUTED').length,
    DRAFT: invoices.filter((i) => i.status === 'DRAFT').length,
    CANCELLED: invoices.filter((i) => i.status === 'CANCELLED').length,
  };
  const outstanding = invoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED' && i.status !== 'DRAFT')
    .reduce((sum, i) => sum + Math.max(0, i.amount - (i.paidAmount || 0)), 0);
  const collected = invoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0);

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
            <h1 className="text-2xl font-display font-bold text-gray-900">Invoices</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Resident dues, reminders and payment reconciliation.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> New invoice
          </button>
        </div>

        {/* Banners */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 w-4 h-4 flex-shrink-0 text-red-600" />
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
        {invoices.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { icon: Receipt, label: 'Invoices', value: String(invoices.length), tone: 'text-accent-600', bg: 'bg-accent-50' },
              { icon: Banknote, label: 'Outstanding', value: formatRs(outstanding), tone: 'text-amber-600', bg: 'bg-amber-50' },
              { icon: CheckCircle2, label: 'Collected', value: formatRs(collected), tone: 'text-emerald-600', bg: 'bg-emerald-50' },
              { icon: AlertTriangle, label: 'Overdue', value: String(counts.OVERDUE), tone: 'text-red-600', bg: 'bg-red-50' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md"
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.tone}`} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">{stat.label}</span>
                </div>
                <p className="text-title font-display tabular-nums text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        {invoices.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
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
                  {s === 'ALL' ? 'All' : statusMeta(s).label}
                  <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>
                    {counts[s]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Automation */}
        <section className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
              <RefreshCw className="w-4 h-4 text-accent-600" />
            </div>
            <h2 className="text-title-sm font-display text-gray-900">Automation</h2>
            <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Reminders */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200/70">
                  <BellRing className="w-4 h-4 text-accent-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-gray-900">Dues reminders</p>
                  <p className="mt-0.5 text-caption-xs text-gray-500">
                    Residents are emailed this many days before an invoice is due.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={reminderDays}
                    onChange={(e) => setReminderDays(Number(e.target.value))}
                    aria-label="Reminder days before due"
                    className={`${fieldInput} w-24 pr-14`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption-xs text-gray-400">
                    days
                  </span>
                </div>
                <button
                  onClick={saveSettings}
                  disabled={settingsLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={runReminders}
                  disabled={runningReminders}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-3.5 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-accent-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningReminders ? 'animate-spin' : ''}`} />
                  {runningReminders ? 'Sending...' : 'Send now'}
                </button>
              </div>
              {reminderResult && <p className="mt-2.5 text-caption-xs text-gray-500">{reminderResult}</p>}
            </div>

            {/* Recurring billing */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200/70">
                  <CalendarClock className="w-4 h-4 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-gray-900">Recurring billing</p>
                  <p className="mt-0.5 text-caption-xs text-gray-500">
                    Auto-generate invoices for every active unit on a set day each month.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="w-36">
                  <Select
                    value={String(billingDay ?? '')}
                    onChange={(e) => setBillingDay(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Off</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>Day {d}</option>
                    ))}
                  </Select>
                </div>
                <button
                  onClick={saveSettings}
                  disabled={settingsLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={runBilling}
                  disabled={runningBilling}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-purple-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningBilling ? 'animate-spin' : ''}`} />
                  {runningBilling ? 'Generating...' : 'Generate now'}
                </button>
              </div>
              {billingResult && <p className="mt-2.5 text-caption-xs text-gray-500">{billingResult}</p>}
            </div>
          </div>

          {settingsMsg && <p className="mt-3 text-caption-xs text-emerald-600">{settingsMsg}</p>}
          {settingsErr && <p className="mt-3 text-caption-xs text-red-600">{settingsErr}</p>}
        </section>

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <Banknote className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">
              {filter === 'ALL' ? 'No invoices yet' : `No ${statusMeta(filter).label.toLowerCase()} invoices`}
            </h3>
            <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
              {filter === 'ALL'
                ? 'Raise one invoice, or switch on recurring billing above to invoice every unit automatically.'
                : 'Try another status filter to see the rest.'}
            </p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <Plus className="w-4 h-4" /> New invoice
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const meta = statusMeta(inv.status);
              const paid = inv.paidAmount || 0;
              return (
                <div
                  key={inv.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-4 py-5 pl-6 pr-5">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.chip} ring-1 transition-transform duration-300 group-hover:scale-110`}>
                      <Receipt className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="truncate text-title-sm font-display text-gray-900">{inv.title}</h3>
                        <span className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            inv.status === 'PAID' ? 'bg-emerald-500' : inv.status === 'OVERDUE' ? 'bg-red-500' : inv.status === 'ISSUED' ? 'bg-accent-500' : 'bg-gray-400'
                          }`} />
                          {meta.label}
                        </span>
                      </div>
                      {inv.description && (
                        <p className="mt-1 line-clamp-1 text-body-sm text-gray-500">{inv.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 font-mono text-caption-xs text-gray-500">
                          {inv.invoiceNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <Home className="w-3 h-3 text-gray-400" />
                          Unit {inv.unitNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <CalendarDays className="w-3 h-3 text-gray-400" />
                          Due {formatDate(inv.dueDate)}
                        </span>
                        {inv.paidAt && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-caption-xs text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Paid {formatDate(inv.paidAt)}
                          </span>
                        )}
                        {/* ADR 008: how it was paid - gateway (Safepay) vs an approved manual proof */}
                        {inv.status === 'PAID' && inv.paymentSource && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-caption-xs text-accent-700">
                            {inv.paymentSource === 'manual_proof' ? 'Paid via proof' : 'Paid via gateway'}
                          </span>
                        )}
                        {inv.paymentProof?.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-caption-xs text-amber-700">
                            <Clock className="w-3 h-3" /> Proof awaiting review
                          </span>
                        )}
                        {inv.paymentProof?.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-caption-xs text-red-700">
                            Proof rejected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p className="text-title font-display tabular-nums text-gray-900">{formatRs(inv.amount)}</p>
                        <p className="mt-0.5 text-caption-xs text-gray-400">
                          {paid > 0 ? `Paid ${formatRs(paid)}` : inv.status === 'OVERDUE' ? 'Overdue' : 'Unpaid'}
                        </p>
                      </div>
                      {inv.status !== 'PAID' && (
                        <button
                          onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                          disabled={deletingId === inv.id}
                          title="Delete invoice"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deletingId === inv.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment history */}
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
              <Landmark className="w-4 h-4 text-accent-600" />
            </div>
            <h2 className="text-title-sm font-display text-gray-900">Payment history</h2>
            <span className="text-caption-xs text-gray-400">Reconcile online payments against invoices</span>
            <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
          </div>

          {paymentsLoading ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200/80 bg-white py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
              <p className="text-body-sm text-gray-500">Loading payments...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
                <CreditCard className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-body font-semibold text-gray-900">No payments recorded yet</p>
              <p className="mt-1 text-caption text-gray-500">Payments appear here as soon as a resident pays their dues.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
                      {['Date', 'Invoice', 'Amount', 'Method', 'Reference', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-accent-50/30">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatDate(p.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{p.invoiceTitle}</div>
                          <div className="font-mono text-caption-xs text-gray-400">{p.invoiceNumber}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-gray-900">{formatRs(p.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                            p.provider === 'safepay'
                              ? 'bg-accent-50 text-accent-700 ring-accent-200/70'
                              : p.provider === 'manual_proof'
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                                : 'bg-gray-100 text-gray-600 ring-gray-200/70'
                          }`}>
                            {p.provider === 'safepay'
                              ? 'Safepay'
                              : p.provider === 'manual_proof'
                                ? 'Manual proof'
                                : 'Offline'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-caption-xs text-gray-500">
                          {p.providerTxnRef || p.providerSessionId || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                            p.status === 'succeeded'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                              : p.status === 'failed'
                                ? 'bg-red-50 text-red-700 ring-red-200/70'
                                : 'bg-amber-50 text-amber-700 ring-amber-200/70'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── Create invoice ──────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={resetForm}
        icon={FileText}
        title="New invoice"
        subtitle="Raise a due against one unit. The resident sees it immediately."
        size="md"
      >
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className={fieldLabel} htmlFor="invoice-unit">Unit</label>
            <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
              <option value="">Select unit...</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
            </Select>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="invoice-title">Title</label>
            <input
              id="invoice-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly maintenance dues"
              required
              maxLength={200}
              className={fieldInput}
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="invoice-description">Description</label>
            <textarea
              id="invoice-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional note for the resident"
              className={`${fieldInput} resize-y`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={fieldLabel} htmlFor="invoice-amount">Amount (Rs.)</label>
              <input
                id="invoice-amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                required
                className={fieldInput}
              />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="invoice-due">Due date</label>
              <input
                id="invoice-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className={fieldInput}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create invoice'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
