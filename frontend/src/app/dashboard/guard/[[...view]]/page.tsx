'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  CheckCircle, XCircle, LogOut, Clock, User, PackagePlus, X, HelpCircle,
  QrCode, Package, PackageCheck, Phone, Car, CalendarClock, AlertTriangle, ImagePlus,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Field } from '@/components/ui/Field';
import { fieldLabel, fieldInput } from '@/components/ui/Modal';
import { ApiError, apiPost, apiGet, apiUpload } from '@/lib/api';
import type { VisitorPassResponse, ParcelResponse } from '@apartment/shared';
import { FAQSection, GUARD_FAQS } from '@/components/faq-section';

type GuardView = 'scan' | 'parcels' | 'recent' | 'faqs';

function viewFromPath(pathname: string): GuardView {
  const seg = pathname.replace('/dashboard/guard', '').split('/').filter(Boolean)[0];
  if (seg === 'parcels') return 'parcels';
  if (seg === 'activity') return 'recent';
  if (seg === 'faqs') return 'faqs';
  return 'scan';
}

// ── Helpers ────────────────────────────────────────────────────────────
const PASS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  CHECKED_IN: 'Checked in',
  CHECKED_OUT: 'Checked out',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

const passVariant = (status: string) => {
  if (status === 'CHECKED_IN') return 'success' as const;
  if (status === 'APPROVED') return 'info' as const;
  if (status === 'PENDING') return 'warning' as const;
  return 'neutral' as const;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const isToday = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  );
};

// ── Presentation pieces ────────────────────────────────────────────────

/** Page heading: icon chip + title + one line of context. */
function ViewHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex items-center gap-3.5">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200 shadow-[0_10px_24px_-12px_rgba(37,99,235,1)]">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <h1 className="text-title font-display text-gray-900">{title}</h1>
        <p className="text-body-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className="absolute inset-x-0 top-0 h-1 bg-accent-500" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
          <p className="mt-2 text-title font-display tabular-nums text-gray-900">{value}</p>
          {hint && <p className="mt-0.5 truncate text-caption-xs text-gray-500">{hint}</p>}
        </div>
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  caption,
  right,
  className = '',
  children,
}: {
  icon: React.ElementType;
  title: string;
  caption?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}
    >
      <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" aria-hidden="true" />
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
          <Icon className="h-4 w-4 text-accent-600" />
        </div>
        <div className="min-w-0">
          <p className="text-body-sm font-semibold leading-tight text-gray-900">{title}</p>
          {caption && <p className="text-caption-xs text-gray-500">{caption}</p>}
        </div>
        {right && <div className="ml-auto flex flex-shrink-0 items-center gap-2">{right}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyRow({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-50">
        <Icon className="h-5 w-5 text-accent-500" />
      </div>
      <p className="text-body-sm font-medium text-gray-600">{title}</p>
      <p className="mt-0.5 max-w-[20rem] text-caption-xs leading-relaxed text-gray-400">{hint}</p>
    </div>
  );
}

export default function GuardDashboard() {
  const pathname = usePathname();
  const view = viewFromPath(pathname);

  const [qrToken, setQrToken] = useState('');
  const [pass, setPass] = useState<VisitorPassResponse | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [recording, setRecording] = useState(false);

  // Lists for the parcels + activity views
  const [passes, setPasses] = useState<VisitorPassResponse[]>([]);
  const [parcels, setParcels] = useState<ParcelResponse[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  // Parcel arrival state
  const [units, setUnits] = useState<{ id: string; unitNumber: string; buildingName: string }[]>([]);
  const [parcelUnitId, setParcelUnitId] = useState('');
  const [parcelDescription, setParcelDescription] = useState('');
  const [parcelPhoto, setParcelPhoto] = useState<File | null>(null);
  const [parcelPreview, setParcelPreview] = useState('');
  const [parcelMsg, setParcelMsg] = useState('');
  const [parcelErr, setParcelErr] = useState('');
  const [loggingParcel, setLoggingParcel] = useState(false);

  const loadLists = useCallback(async () => {
    try {
      const [passList, parcelList] = await Promise.all([
        apiGet<VisitorPassResponse[]>('/api/v1/visitors').catch(() => []),
        apiGet<ParcelResponse[]>('/api/v1/parcels').catch(() => []),
      ]);
      setPasses(passList || []);
      setParcels(parcelList || []);
    } finally {
      setListsLoading(false);
    }
  }, []);

  // Load units for parcel arrival logging + the gate lists
  useEffect(() => {
    let cancelled = false;
    apiGet<any[]>('/api/v1/units')
      .then((data) => {
        if (cancelled) return;
        setUnits(
          (data || []).map((u) => ({ id: u.id, unitNumber: u.unitNumber, buildingName: u.buildingName || '' }))
        );
      })
      .catch(() => {});
    loadLists();
    return () => {
      cancelled = true;
    };
  }, [loadLists]);

  // Reset transient state when switching between views
  useEffect(() => {
    setPass(null);
    setVerifyError('');
    setActionMsg('');
    setParcelMsg('');
    setParcelErr('');
  }, [view]);

  const handleVerify = async () => {
    if (!qrToken.trim()) return;
    setVerifying(true);
    setVerifyError('');
    setPass(null);
    setActionMsg('');

    try {
      const data = await apiPost<VisitorPassResponse>(`/api/v1/visitors/verify/${qrToken.trim()}`);
      setPass(data);
    } catch (err) {
      if (err instanceof ApiError) setVerifyError(err.message);
      else setVerifyError('Failed to verify QR code');
    } finally {
      setVerifying(false);
    }
  };

  const handleGateAction = async (action: 'ENTRY' | 'EXIT') => {
    if (!pass) return;
    setRecording(true);
    setActionMsg('');

    try {
      await apiPost(`/api/v1/visitors/${pass.id}/gate`, { action });
      setActionMsg(action === 'ENTRY' ? 'Check-in recorded' : 'Check-out recorded');
      setPass(null);
      setQrToken('');
      loadLists();
    } catch (err) {
      if (err instanceof ApiError) setActionMsg(`Error: ${err.message}`);
      else setActionMsg('Failed to record');
    } finally {
      setRecording(false);
    }
  };

  const handleLogParcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelUnitId || !parcelDescription.trim()) return;
    setLoggingParcel(true);
    setParcelMsg('');
    setParcelErr('');
    try {
      let photoUrl = '';
      if (parcelPhoto) {
        const formData = new FormData();
        formData.append('photo', parcelPhoto);
        const res = await apiUpload<{ url: string }>('/api/v1/parcels/photo', formData);
        photoUrl = res.url;
      }
      await apiPost('/api/v1/parcels', {
        unitId: parcelUnitId,
        description: parcelDescription.trim(),
        ...(photoUrl ? { photoUrl } : {}),
      });
      setParcelMsg('Parcel logged. The resident has been notified.');
      setParcelUnitId('');
      setParcelDescription('');
      setParcelPhoto(null);
      setParcelPreview('');
      loadLists();
    } catch (err) {
      if (err instanceof ApiError) setParcelErr(err.message);
      else setParcelErr('Failed to log parcel');
    } finally {
      setLoggingParcel(false);
    }
  };

  // ── Derived data for the lists ───────────────────────────────────────
  const onSite = passes.filter((p) => p.status === 'CHECKED_IN');
  const checkedOut = passes.filter((p) => p.status === 'CHECKED_OUT');
  const checkedOutToday = checkedOut.filter((p) => isToday(p.updatedAt));
  const expectedToday = passes.filter(
    (p) => p.status === 'APPROVED' && p.expectedArrival && isToday(p.expectedArrival)
  );
  const pendingApproval = passes.filter((p) => p.status === 'PENDING');
  const waitingParcels = parcels.filter((p) => p.status === 'ARRIVED');
  const collectedToday = parcels.filter((p) => p.status === 'COLLECTED' && isToday(p.updatedAt));

  return (
    <div className="space-y-6">
      {/* ══ Scan QR ══════════════════════════════════════════════════ */}
      {view === 'scan' && (
        <>
          <ViewHeader icon={QrCode} title="Visitor check-in" subtitle="Verify a pass, then log the entry or exit." />

          <Panel icon={QrCode} title="Verify a pass" caption="Scan the QR code or type the token by hand">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <QrCode className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="Scan QR code or enter token"
                  aria-label="Visitor pass token"
                  className={`${fieldInput} pl-10 pr-10 font-mono uppercase tracking-wider`}
                  autoFocus
                />
                {qrToken && (
                  <button
                    type="button"
                    onClick={() => setQrToken('')}
                    aria-label="Clear token"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={handleVerify}
                disabled={verifying || !qrToken.trim()}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-accent-600 px-6 text-body-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
              >
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>

            <p className="mt-3 text-caption-xs text-gray-400">
              Token format looks like VP-1A2B3C4D5E6F7788. Ask the visitor to open their pass if the QR will not scan.
            </p>
          </Panel>

          {verifyError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-body-sm text-red-700">
              <XCircle className="mt-0.5 h-4.5 w-4.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">This pass cannot be used</p>
                <p className="mt-0.5">{verifyError}</p>
              </div>
            </div>
          )}

          {actionMsg && (
            <div
              className={`flex items-center gap-3 rounded-2xl border px-5 py-4 text-body-sm ${
                actionMsg.startsWith('Error')
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {actionMsg.startsWith('Error') ? (
                <XCircle className="h-4.5 w-4.5 flex-shrink-0" />
              ) : (
                <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" />
              )}
              {actionMsg}
            </div>
          )}

          {/* Visitor found */}
          {pass && (
            <section className="relative overflow-hidden rounded-2xl border-2 border-accent-200 bg-white shadow-[0_12px_32px_-16px_rgba(37,99,235,0.35)]">
              <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent-600 via-accent-400 to-transparent" aria-hidden="true" />

              <div className="flex items-center gap-4 border-b border-gray-100 px-5 py-5">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-title-sm font-semibold text-white ring-1 ring-accent-200">
                  {pass.visitorName
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join('') || <User className="h-6 w-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Visitor</p>
                  <h2 className="truncate text-title font-display text-gray-900">{pass.visitorName}</h2>
                </div>
                <StatusBadge variant={passVariant(pass.status)}>{PASS_LABELS[pass.status] || pass.status}</StatusBadge>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5">
                <Field label="Unit">{pass.unitNumber || 'Not set'}</Field>
                <Field label="Resident">{pass.residentName || 'Not set'}</Field>
                <Field label="Phone">{pass.visitorPhone || 'Not provided'}</Field>
                <Field label="Vehicle">{pass.vehicleNumber || 'None'}</Field>
                <Field label="Expected" hint={pass.expectedArrival ? timeAgo(pass.expectedArrival) : undefined}>
                  {pass.expectedArrival
                    ? new Date(pass.expectedArrival).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Any time'}
                </Field>
                <Field label="Purpose">{pass.purpose || 'Not stated'}</Field>
              </div>

              <div className="border-t border-gray-100 bg-gray-50/70 p-4">
                {(pass.status === 'APPROVED' || pass.status === 'PENDING') && (
                  <button
                    onClick={() => handleGateAction('ENTRY')}
                    disabled={recording}
                    className="flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-xl bg-accent-600 text-body font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:opacity-50"
                  >
                    <CheckCircle className="h-6 w-6" />
                    {recording ? 'Recording...' : 'Check in'}
                  </button>
                )}
                {pass.status === 'CHECKED_IN' && (
                  <button
                    onClick={() => handleGateAction('EXIT')}
                    disabled={recording}
                    className="flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-xl bg-neutral-800 text-body font-semibold text-white transition-all hover:bg-neutral-700 disabled:opacity-50"
                  >
                    <LogOut className="h-6 w-6" />
                    {recording ? 'Recording...' : 'Check out'}
                  </button>
                )}
                {pass.status !== 'APPROVED' && pass.status !== 'PENDING' && pass.status !== 'CHECKED_IN' && (
                  <p className="text-center text-caption-xs text-gray-500">
                    No gate action is available for a {PASS_LABELS[pass.status]?.toLowerCase() || pass.status} pass.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* On-site summary */}
          {!pass && (
            <Panel icon={User} title="On site right now" caption="Visitors checked in and not yet out">
              {onSite.length > 0 ? (
                <div className="-mx-5 -my-5 divide-y divide-gray-100">
                  {onSite.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex items-center gap-3.5 px-5 py-3.5">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
                        <User className="h-4 w-4 text-accent-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-gray-900">{p.visitorName}</p>
                        <p className="truncate text-caption-xs text-gray-500">
                          Unit {p.unitNumber} &middot; in {timeAgo(p.updatedAt)}
                        </p>
                      </div>
                      <StatusBadge variant="success" dot={false}>
                        On site
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyRow icon={CheckCircle} title="Nobody is on site" hint="Check-ins from this gate show up here until the visitor leaves." />
              )}
            </Panel>
          )}
        </>
      )}

      {/* ══ Packages ═════════════════════════════════════════════════ */}
      {view === 'parcels' && (
        <>
          <ViewHeader icon={Package} title="Packages" subtitle="Log what arrives at the gate for a unit." />

          <div className="grid grid-cols-2 gap-4">
            <Tile icon={Package} label="Waiting" value={waitingParcels.length} hint="Not collected yet" />
            <Tile icon={PackageCheck} label="Collected today" value={collectedToday.length} hint="Handed over" />
          </div>

          <Panel icon={PackagePlus} title="Log parcel arrival" caption="The resident is notified as soon as you save">
            <form onSubmit={handleLogParcel} className="space-y-4">
              <div>
                <span className={fieldLabel}>Unit</span>
                <Select value={parcelUnitId} onChange={(e) => setParcelUnitId(e.target.value)} required>
                  <option value="">Select a unit...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber}
                      {u.buildingName ? ` (${u.buildingName})` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className={fieldLabel} htmlFor="parcel-desc">
                  Description
                </label>
                <input
                  id="parcel-desc"
                  type="text"
                  value={parcelDescription}
                  onChange={(e) => setParcelDescription(e.target.value)}
                  placeholder="e.g. Amazon package, large box from FedEx"
                  required
                  className={fieldInput}
                />
              </div>

              <div>
                <span className={fieldLabel}>Photo (optional)</span>
                {parcelPreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={parcelPreview} alt="Parcel photo preview" className="h-28 w-28 rounded-xl border border-gray-200 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setParcelPhoto(null);
                        setParcelPreview('');
                      }}
                      aria-label="Remove photo"
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 px-4 py-3.5 transition-colors hover:border-accent-300 hover:bg-accent-50/40">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50">
                      <ImagePlus className="h-4 w-4 text-accent-600" />
                    </span>
                    <span className="text-body-sm text-gray-500">Add a photo of the parcel</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setParcelPhoto(f);
                        setParcelPreview(f ? URL.createObjectURL(f) : '');
                      }}
                    />
                  </label>
                )}
              </div>

              {parcelErr && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{parcelErr}</span>
                </div>
              )}
              {parcelMsg && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-body-sm text-emerald-700">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{parcelMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loggingParcel || !parcelUnitId || !parcelDescription.trim()}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-body font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
              >
                <PackagePlus className="h-5 w-5" />
                {loggingParcel ? 'Logging...' : 'Log arrival'}
              </button>
            </form>
          </Panel>

          <Panel
            icon={Package}
            title="Waiting for collection"
            caption="Parcels sitting at the gate"
            right={
              waitingParcels.length > 0 ? (
                <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-200/60">
                  {waitingParcels.length}
                </span>
              ) : undefined
            }
          >
            {listsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
              </div>
            ) : waitingParcels.length > 0 ? (
              <div className="-mx-5 -my-5 divide-y divide-gray-100">
                {waitingParcels.map((p) => (
                  <div key={p.id} className="group flex items-center gap-3.5 px-5 py-3.5">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" className="h-11 w-11 flex-shrink-0 rounded-xl border border-gray-200 object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
                        <Package className="h-4.5 w-4.5 text-accent-600" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-gray-900">
                        Unit {p.unitNumber} &middot; {p.description}
                      </p>
                      <p className="truncate text-caption-xs text-gray-500">
                        Logged {timeAgo(p.createdAt)}
                        {p.loggedByUserName ? ` by ${p.loggedByUserName}` : ''}
                      </p>
                    </div>
                    <StatusBadge variant="warning" dot={false}>
                      Waiting
                    </StatusBadge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyRow icon={PackageCheck} title="No parcels waiting" hint="Anything you log at the gate stays here until the resident collects it." />
            )}
          </Panel>
        </>
      )}

      {/* ══ Recent activity ══════════════════════════════════════════ */}
      {view === 'recent' && (
        <>
          <ViewHeader icon={Clock} title="Recent activity" subtitle="Who came through this gate, and when." />

          <div className="grid grid-cols-2 gap-4">
            <Tile icon={User} label="On site now" value={onSite.length} hint="Checked in" />
            <Tile icon={LogOut} label="Out today" value={checkedOutToday.length} hint="Checked out" />
            <Tile icon={CalendarClock} label="Expected today" value={expectedToday.length} hint="Approved passes" />
            <Tile icon={AlertTriangle} label="Awaiting approval" value={pendingApproval.length} hint="Needs a resident" />
          </div>

          {listsLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-gray-200/80 bg-white py-14">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
            </div>
          ) : (
            <>
              <Panel
                icon={User}
                title="On site now"
                caption="Still inside"
                right={
                  onSite.length > 0 ? (
                    <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-200/60">
                      {onSite.length}
                    </span>
                  ) : undefined
                }
              >
                {onSite.length > 0 ? (
                  <div className="-mx-5 -my-5 divide-y divide-gray-100">
                    {onSite.map((p) => (
                      <div key={p.id} className="flex items-center gap-3.5 px-5 py-4">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
                          <User className="h-4.5 w-4.5 text-accent-600" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-medium text-gray-900">{p.visitorName}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption-xs text-gray-500">
                            <span>Unit {p.unitNumber}</span>
                            {p.visitorPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-gray-400" />
                                {p.visitorPhone}
                              </span>
                            )}
                            {p.vehicleNumber && (
                              <span className="flex items-center gap-1">
                                <Car className="h-3 w-3 text-gray-400" />
                                {p.vehicleNumber}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <StatusBadge variant="success" dot={false}>
                            On site
                          </StatusBadge>
                          <p className="mt-1 text-caption-xs text-gray-400">in {timeAgo(p.updatedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyRow icon={CheckCircle} title="The gate is clear" hint="No visitor is currently checked in." />
                )}
              </Panel>

              <Panel
                icon={LogOut}
                title="Checked out"
                caption="Most recent first"
                right={
                  checkedOut.length > 0 ? (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-caption-xs font-semibold text-gray-600">
                      {Math.min(8, checkedOut.length)}
                    </span>
                  ) : undefined
                }
              >
                {checkedOut.length > 0 ? (
                  <div className="-mx-5 -my-5 divide-y divide-gray-100">
                    {checkedOut.slice(0, 8).map((p) => (
                      <div key={p.id} className="flex items-center gap-3.5 px-5 py-3.5">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 ring-1 ring-gray-200">
                          <LogOut className="h-4 w-4 text-gray-500" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-medium text-gray-900">{p.visitorName}</p>
                          <p className="truncate text-caption-xs text-gray-500">
                            Unit {p.unitNumber} &middot; {PASS_LABELS[p.status]?.toLowerCase() || p.status}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-caption-xs text-gray-400">{timeAgo(p.updatedAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyRow icon={Clock} title="No check-outs yet" hint="Visitors you check out will be listed here." />
                )}
              </Panel>

              {expectedToday.length > 0 && (
                <Panel icon={CalendarClock} title="Expected today" caption="Approved passes with a time slot">
                  <div className="-mx-5 -my-5 divide-y divide-gray-100">
                    {expectedToday.map((p) => (
                      <div key={p.id} className="flex items-center gap-3.5 px-5 py-3.5">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
                          <CalendarClock className="h-4 w-4 text-accent-600" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-medium text-gray-900">{p.visitorName}</p>
                          <p className="truncate text-caption-xs text-gray-500">
                            Unit {p.unitNumber}
                            {p.purpose ? ` \u00b7 ${p.purpose}` : ''}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-caption-xs font-medium text-gray-500">
                          {new Date(p.expectedArrival!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          )}
        </>
      )}

      {/* ══ FAQs ═════════════════════════════════════════════════════ */}
      {view === 'faqs' && (
        <div className="max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50">
              <HelpCircle className="h-4.5 w-4.5 text-accent-600" />
            </div>
            <div>
              <h1 className="text-display-sm text-gray-900">Help &amp; FAQs</h1>
              <p className="text-body-sm text-gray-700">Answers to the questions guards ask most.</p>
            </div>
          </div>
          <FAQSection faqs={GUARD_FAQS} audience="security guards" showHeader={false} />
        </div>
      )}
    </div>
  );
}
