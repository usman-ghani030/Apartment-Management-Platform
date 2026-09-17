'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, QrCode, X, Car, Phone, CalendarDays, Copy, Check,
  ClipboardList, ShieldCheck, LogIn, CopyCheck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatTile, StatTileGrid } from '@/components/ui/StatTile';
import { Panel, CountPill, PanelEmpty } from '@/components/ui/Panel';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { VisitorPassResponse } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Visitor passes: pre-approve someone, hand them a QR at the gate, cancel if
// plans change. Same endpoints as before, rebuilt on the design system.
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = 'warning' | 'info' | 'success' | 'neutral' | 'danger';

const STATUS_META: Record<string, { label: string; badge: BadgeVariant; rail: string }> = {
  PENDING: { label: 'Awaiting approval', badge: 'warning', rail: 'bg-amber-400' },
  APPROVED: { label: 'Approved', badge: 'info', rail: 'bg-accent-500' },
  CHECKED_IN: { label: 'On site', badge: 'success', rail: 'bg-emerald-500' },
  CHECKED_OUT: { label: 'Checked out', badge: 'neutral', rail: 'bg-gray-300' },
  EXPIRED: { label: 'Expired', badge: 'neutral', rail: 'bg-gray-300' },
  CANCELLED: { label: 'Cancelled', badge: 'danger', rail: 'bg-gray-300' },
};

const metaFor = (status: string) =>
  STATUS_META[status] || { label: status, badge: 'neutral' as BadgeVariant, rail: 'bg-gray-300' };

const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ResidentVisitorsPage() {
  const router = useRouter();
  const [passes, setPasses] = useState<VisitorPassResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showQr, setShowQr] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchPasses = useCallback(async () => {
    try {
      const data = await apiGet<VisitorPassResponse[]>('/api/v1/visitors');
      setPasses(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  const closeForm = () => {
    setVisitorName(''); setVisitorPhone(''); setVisitorEmail('');
    setVehicleNumber(''); setPurpose(''); setShowForm(false); setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const body: any = { visitorName, visitorPhone };
      if (visitorEmail) body.visitorEmail = visitorEmail;
      if (vehicleNumber) body.vehicleNumber = vehicleNumber;
      if (purpose) body.purpose = purpose;
      await apiPost('/api/v1/visitors', body);
      closeForm();
      setSuccess('Pass created. Show the QR code at the gate, or share it with your visitor.');
      fetchPasses();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (id: string) => {
    try {
      await apiPost(`/api/v1/visitors/${id}/cancel`);
      fetchPasses();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const copyToken = async (pass: VisitorPassResponse) => {
    try {
      await navigator.clipboard.writeText(pass.qrToken);
      setCopiedId(pass.id);
      setTimeout(() => setCopiedId((current) => (current === pass.id ? null : current)), 2000);
    } catch {
      setError('Could not copy the token. Select it manually instead.');
    }
  };

  if (loading) return <PageSkeleton width="max-w-5xl" />;

  const activePasses = passes.filter((p) => ['PENDING', 'APPROVED', 'CHECKED_IN'].includes(p.status));
  const historyPasses = passes.filter((p) => ['CHECKED_OUT', 'EXPIRED', 'CANCELLED'].includes(p.status));
  const pendingCount = passes.filter((p) => p.status === 'PENDING').length;
  const onSiteCount = passes.filter((p) => p.status === 'CHECKED_IN').length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/resident')}
            aria-label="Back to dashboard"
            className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-display-sm font-display text-gray-900">Visitor passes</h1>
              <p className="text-body-sm text-gray-500">Let the gate know who to expect, with a QR they scan on arrival</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { closeForm(); setShowForm(true); }}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:-translate-y-0.5 hover:bg-accent-700"
        >
          <Plus className="h-4 w-4" /> New pass
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <p className="flex-1 text-body-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <p className="flex-1 text-body-sm text-emerald-700">{success}</p>
          <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {passes.length > 0 && (
        <StatTileGrid className="mb-6">
          <StatTile icon={ClipboardList} label="Active" value={activePasses.length} hint={activePasses.length === 0 ? 'None right now' : 'Still valid'} />
          <StatTile
            icon={ShieldCheck}
            label="Awaiting approval"
            value={pendingCount}
            hint={pendingCount === 0 ? 'Nothing pending' : 'Needs a decision'}
            tone={pendingCount > 0 ? 'warning' : 'accent'}
          />
          <StatTile icon={LogIn} label="On site" value={onSiteCount} hint={onSiteCount === 0 ? 'Nobody inside' : 'Checked in now'} />
          <StatTile icon={CopyCheck} label="Past passes" value={historyPasses.length} hint="Closed, expired or cancelled" />
        </StatTileGrid>
      )}

      <Panel
        icon={QrCode}
        title="Active passes"
        hint={activePasses.length === 0 ? 'No passes are valid right now' : 'Tap a pass to show its gate QR code'}
        meta={<CountPill tone={activePasses.length === 0 ? 'neutral' : 'accent'}>{activePasses.length}</CountPill>}
      >
        {activePasses.length === 0 ? (
          <PanelEmpty
            icon={QrCode}
            title="No active passes"
            description="Create a pass and your visitor gets a QR code the guard can scan at the gate."
            action={
              <button
                onClick={() => { closeForm(); setShowForm(true); }}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700"
              >
                <Plus className="h-4 w-4" /> Create a pass
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {activePasses.map((p) => {
              const meta = metaFor(p.status);
              const qrOpen = showQr === p.id;
              return (
                <li key={p.id} className="relative">
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.rail}`} aria-hidden="true" />

                  <div className="px-5 py-4 pl-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
                          <h3 className="truncate text-body font-semibold text-gray-900">{p.visitorName}</h3>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption-xs text-gray-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-gray-400" /> {p.visitorPhone}
                          </span>
                          {p.vehicleNumber && (
                            <span className="inline-flex items-center gap-1.5">
                              <Car className="h-3.5 w-3.5 text-gray-400" /> {p.vehicleNumber}
                            </span>
                          )}
                          {p.purpose && (
                            <span className="inline-flex items-center gap-1.5">
                              <ClipboardList className="h-3.5 w-3.5 text-gray-400" /> {p.purpose}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-gray-400" /> {shortDateTime(p.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-2">
                        <button
                          onClick={() => setShowQr(qrOpen ? null : p.id)}
                          aria-expanded={qrOpen}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-body-sm font-medium transition-all ${
                            qrOpen
                              ? 'bg-accent-600 text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)]'
                              : 'border border-accent-200 bg-accent-50 text-accent-700 hover:border-accent-300 hover:bg-accent-100'
                          }`}
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          {qrOpen ? 'Hide QR' : 'Show QR'}
                        </button>
                        {['PENDING', 'APPROVED'].includes(p.status) && (
                          <button
                            onClick={() => handleCancel(p.id)}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-body-sm font-medium text-gray-500 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {qrOpen && (
                      <div className="mt-4 grid gap-5 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-5 sm:grid-cols-[auto_1fr]">
                        <div className="mx-auto rounded-2xl border border-gray-200/80 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                          <QRCodeSVG value={p.qrToken} size={148} level="M" includeMargin />
                        </div>
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-gray-900">Gate pass for {p.visitorName}</p>
                          <p className="mt-1 text-caption-xs leading-relaxed text-gray-500">
                            Show this code to the guard, or send it to your visitor. It is checked in the Scan QR
                            screen at the gate.
                          </p>

                          <div className="mt-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Pass token</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <code className="min-w-0 flex-1 truncate rounded-xl border border-gray-200/80 bg-white px-3 py-2 font-mono text-caption-xs text-gray-600">
                                {p.qrToken}
                              </code>
                              <button
                                onClick={() => copyToken(p)}
                                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-caption-xs font-semibold text-gray-600 transition-all hover:border-accent-200 hover:text-accent-700"
                              >
                                {copiedId === p.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedId === p.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <p className="mt-3 text-caption-xs text-gray-400">Created {shortDateTime(p.createdAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {historyPasses.length > 0 && (
        <Panel
          icon={CopyCheck}
          title="History"
          hint="Passes that are closed, expired or cancelled"
          meta={<CountPill tone="neutral">{historyPasses.length}</CountPill>}
          className="mt-6"
        >
          <ul className="divide-y divide-gray-100">
            {historyPasses.map((p) => {
              const meta = metaFor(p.status);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <StatusBadge variant={meta.badge} dot={false}>{meta.label}</StatusBadge>
                  <span className="text-body-sm font-medium text-gray-700">{p.visitorName}</span>
                  {p.vehicleNumber && (
                    <span className="inline-flex items-center gap-1.5 text-caption-xs text-gray-400">
                      <Car className="h-3 w-3" /> {p.vehicleNumber}
                    </span>
                  )}
                  <span className="ml-auto text-caption-xs text-gray-400">{shortDateTime(p.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* ── New pass ────────────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title="Create visitor pass"
        subtitle="The gate uses these details to verify your visitor on arrival"
        icon={QrCode}
        footer={
          <>
            <button
              type="submit"
              form="create-pass"
              disabled={submitting}
              className="flex-1 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {submitting ? 'Creating...' : 'Create pass'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </button>
          </>
        }
      >
        <form id="create-pass" onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={fieldLabel} htmlFor="visitor-name">Visitor name</label>
            <input
              id="visitor-name"
              type="text"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="e.g. John Doe"
              required
              maxLength={100}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="visitor-phone">Phone</label>
            <input
              id="visitor-phone"
              type="tel"
              value={visitorPhone}
              onChange={(e) => setVisitorPhone(e.target.value)}
              placeholder="e.g. +92 300 1234567"
              required
              maxLength={30}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="visitor-email">Email (optional)</label>
            <input
              id="visitor-email"
              type="email"
              value={visitorEmail}
              onChange={(e) => setVisitorEmail(e.target.value)}
              placeholder="visitor@email.com"
              maxLength={200}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="visitor-vehicle">Vehicle number (optional)</label>
            <input
              id="visitor-vehicle"
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. ABC 1234"
              maxLength={30}
              className={fieldInput}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={fieldLabel} htmlFor="visitor-purpose">Purpose (optional)</label>
            <input
              id="visitor-purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Delivery, family visit, maintenance"
              maxLength={200}
              className={fieldInput}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-body-sm text-red-700 sm:col-span-2">{error}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
