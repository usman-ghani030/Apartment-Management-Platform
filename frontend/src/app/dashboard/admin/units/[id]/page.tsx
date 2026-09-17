'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Home, Building2, User, Mail, Phone, Ticket, ExternalLink,
  ArrowRightLeft, CheckCircle, XCircle, AlertTriangle, Layers, BedDouble, Users, CalendarDays,
} from 'lucide-react';
import { auth, ApiError, apiGet, apiPost } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { StatusBadge } from '@/components/ui/StatusBadge';

const UNIT_TYPES: Record<string, string> = {
  OWNER_OCCUPIED: 'Owner Occupied',
  RENTED: 'Rented',
  VACANT: 'Vacant',
};

const BEDROOM_TYPES: Record<string, string> = {
  STUDIO: 'Studio',
  ONE_BED: '1 Bedroom',
  TWO_BED: '2 Bedrooms',
  THREE_BED: '3 Bedrooms',
  FOUR_BED: '4 Bedrooms',
  FOUR_PLUS_BED: '4+ Bedrooms',
};

/** Role is the one coloured value on the occupant rows. */
const roleText = (role: string) =>
  role === 'COMMITTEE_ADMIN' ? 'text-purple-700' : role === 'SECURITY_GUARD' ? 'text-amber-700' : 'text-emerald-700';

const roleLabel = (role: string) =>
  role === 'COMMITTEE_ADMIN' ? 'Admin' : role === 'SECURITY_GUARD' ? 'Guard' : 'Resident';

const ticketVariant = (status: string) => {
  if (status === 'OPEN' || status === 'ASSIGNED') return 'warning' as const;
  if (status === 'IN_PROGRESS') return 'info' as const;
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success' as const;
  return 'neutral' as const;
};

interface UnitDetail {
  id: string;
  unitNumber: string;
  floor: number;
  type: string;
  bedroomType: string | null;
  buildingId: string;
  buildingName: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  hasLinkedResident: boolean;
  members: UnitMember[];
  recentTickets: UnitTicket[];
  createdAt: string;
  updatedAt: string;
}

interface UnitMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface UnitTicket {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

// ── Local presentation pieces ─────────────────────────────────────────

/** Stat tile: accent top rule, eyebrow label, icon chip. */
function Tile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className="absolute inset-x-0 top-0 h-1 bg-accent-500" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
          <p className="mt-2.5 truncate text-title font-display text-gray-900">{value}</p>
          {hint && <p className="mt-1 truncate text-caption-xs text-gray-500">{hint}</p>}
        </div>
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </div>
  );
}

/** Card shell: accent top rule, icon-chip header, padded body. */
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
  caption: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}
    >
      <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" aria-hidden="true" />
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200">
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-body-sm font-semibold leading-tight text-gray-900">{title}</p>
          <p className="text-caption-xs text-gray-500">{caption}</p>
        </div>
        {right && <div className="ml-auto flex flex-shrink-0 items-center gap-2">{right}</div>}
      </div>
      <div className="flex flex-1 flex-col p-5">{children}</div>
    </section>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatPaisa = (paisa: number) => `Rs ${(paisa / 100).toLocaleString('en-PK')}`;

export default function UnitDetailPage() {
  const router = useRouter();
  const params = useParams();
  const unitId = params.id as string;

  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferCheck, setTransferCheck] = useState<any>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [completingTransfer, setCompletingTransfer] = useState(false);

  useEffect(() => {
    auth.me().catch(() => router.push('/login'));
    fetchUnit();
  }, [router, unitId]);

  const fetchUnit = async () => {
    try {
      const data = await apiGet<UnitDetail>(`/api/v1/units/${unitId}`);
      setUnit(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load unit');
    } finally {
      setLoading(false);
    }
  };

  const closeTransfer = () => {
    setShowTransfer(false);
    setTransferCheck(null);
  };

  const handleOpenTransfer = async () => {
    setError('');
    setSuccess('');
    setTransferLoading(true);
    setShowTransfer(true);
    try {
      const data = await apiGet<any>(`/api/v1/units/${unitId}/transfer-check`);
      setTransferCheck(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      setShowTransfer(false);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCompleteTransfer = async () => {
    setCompletingTransfer(true);
    setError('');
    try {
      const result = await apiPost<any>(`/api/v1/units/${unitId}/complete-transfer`, {});
      setSuccess(`Transfer completed - ${result.deactivatedMembers} member(s) deactivated, primary contact cleared`);
      closeTransfer();
      fetchUnit();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setCompletingTransfer(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc] text-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          <p className="text-body-sm text-gray-500">Loading unit...</p>
        </div>
      </div>
    );
  }

  if (error && !unit) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <button
            onClick={() => router.push('/dashboard/admin/units')}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to units
          </button>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-body-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error || 'Unit not found'}
          </div>
        </div>
      </div>
    );
  }

  const u = unit!;
  const hasOccupants = u.hasLinkedResident || !!u.primaryContactName;
  const isVacant = u.type === 'VACANT';
  const occupancy = UNIT_TYPES[u.type] || u.type;
  const bedrooms = u.bedroomType ? BEDROOM_TYPES[u.bedroomType] || u.bedroomType : 'Not specified';
  const statusLabel = isVacant ? 'Vacant' : u.hasLinkedResident ? 'Linked resident' : 'Occupied';

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start gap-4">
          <button
            onClick={() => router.push('/dashboard/admin/units')}
            aria-label="Back to units"
            className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200 shadow-[0_10px_24px_-12px_rgba(37,99,235,1)]">
              <Home className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Unit</span>
                <StatusBadge variant={isVacant ? 'warning' : u.hasLinkedResident ? 'success' : 'info'}>
                  {statusLabel}
                </StatusBadge>
              </div>
              <h1 className="mt-1 truncate text-display-sm font-display text-gray-900">Unit {u.unitNumber}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-body-sm text-gray-500">
                <button
                  onClick={() => router.push(`/dashboard/admin/buildings/${u.buildingId}`)}
                  className="inline-flex items-center gap-1 font-medium text-accent-700 transition-colors hover:text-accent-800 hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {u.buildingName}
                </button>
                <span aria-hidden="true">&middot;</span>
                Floor {u.floor}
                <span aria-hidden="true">&middot;</span>
                {bedrooms}
              </p>
            </div>
          </div>

          {hasOccupants && (
            <button
              onClick={handleOpenTransfer}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-body-sm font-medium text-red-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50"
            >
              <ArrowRightLeft className="h-4 w-4" /> Transfer / Move-out
            </button>
          )}
        </div>

        {/* ── Banners ────────────────────────────────────────────── */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-body-sm text-red-700">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="min-w-0">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-body-sm text-emerald-700">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="min-w-0">{success}</span>
          </div>
        )}

        {/* ── At a glance ────────────────────────────────────────── */}
        <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile icon={Layers} label="Occupancy" value={occupancy} hint={isVacant ? 'No one living here' : 'Currently in use'} />
          <Tile icon={BedDouble} label="Bedrooms" value={u.bedroomType ? bedrooms.replace(' Bedrooms', '') : '-'} hint={u.bedroomType ? 'Bedroom type' : 'Not specified'} />
          <Tile icon={Building2} label="Floor" value={u.floor} hint={u.buildingName} />
          <Tile
            icon={Users}
            label="People"
            value={u.members.length > 0 ? u.members.length : u.primaryContactName ? 1 : 0}
            hint={u.hasLinkedResident ? 'Linked accounts' : u.primaryContactName ? 'Unlinked contact' : 'Nobody on file'}
          />
        </div>

        {/* ── Occupant + unit details ────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-5">
          <Panel
            icon={User}
            title="Occupant"
            caption={u.hasLinkedResident ? 'Linked to an app account' : 'Contact on file'}
            className="lg:col-span-3"
            right={
              u.hasLinkedResident ? (
                <StatusBadge variant="success">Linked</StatusBadge>
              ) : u.primaryContactName ? (
                <StatusBadge variant="warning">Not linked</StatusBadge>
              ) : undefined
            }
          >
            {u.hasLinkedResident && u.members.length > 0 ? (
              <div className="space-y-3">
                {u.members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => router.push(`/dashboard/admin/directory/${member.userId}`)}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-gray-200/80 bg-gray-50/60 px-4 py-3.5 text-left transition-all hover:border-accent-200 hover:bg-accent-50/40"
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-body-sm font-semibold text-white ring-1 ring-accent-200">
                      {initials(member.name) || <User className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-semibold text-gray-900 transition-colors group-hover:text-accent-700">
                        {member.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-caption-xs text-gray-500">
                        <Mail className="h-3 w-3 flex-shrink-0 text-gray-400" />
                        {member.email}
                      </span>
                    </span>
                    <span className={`flex-shrink-0 text-[11px] font-semibold ${roleText(member.role)}`}>
                      {roleLabel(member.role)}
                    </span>
                  </button>
                ))}
              </div>
            ) : u.primaryContactName ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200/80 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 ring-1 ring-gray-200">
                      <User className="h-4.5 w-4.5 text-gray-400" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-gray-900">{u.primaryContactName}</p>
                      <p className="text-caption-xs text-gray-500">Primary contact, not yet on the app</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-gray-200/70 pt-4 sm:grid-cols-2">
                    <Field label="Email">{u.primaryContactEmail || 'Not provided'}</Field>
                    <Field label="Phone">{u.primaryContactPhone || 'Not provided'}</Field>
                  </div>
                </div>

                <p className="text-caption-xs leading-relaxed text-gray-500">
                  An unlinked contact cannot see notices, pay dues, or raise tickets. Inviting them creates their
                  membership for this unit.
                </p>

                {u.primaryContactEmail && (
                  <button
                    onClick={() =>
                      router.push(
                        `/dashboard/admin/memberships?inviteEmail=${encodeURIComponent(u.primaryContactEmail!)}&inviteName=${encodeURIComponent(u.primaryContactName || '')}&unitId=${u.id}`
                      )
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:-translate-y-0.5 hover:bg-accent-700"
                  >
                    <ExternalLink className="h-4 w-4" /> Invite as resident
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-50">
                  <User className="h-5 w-5 text-accent-500" />
                </div>
                <p className="text-body-sm font-medium text-gray-600">Nobody assigned to this unit</p>
                <p className="mt-0.5 max-w-[18rem] text-caption-xs leading-relaxed text-gray-400">
                  Add a resident from the Residents page and they will appear here.
                </p>
                <button
                  onClick={() => router.push('/dashboard/admin/memberships')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-body-sm font-medium text-gray-600 transition-all hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
                >
                  <Users className="h-3.5 w-3.5" /> Go to residents
                </button>
              </div>
            )}
          </Panel>

          <Panel icon={Layers} title="Unit details" caption="Records for this flat" className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
              <Field label="Unit">{u.unitNumber}</Field>
              <Field label="Occupancy">{occupancy}</Field>
              <Field label="Floor">{u.floor}</Field>
              <Field label="Bedrooms">{bedrooms}</Field>
              <Field label="Building">{u.buildingName}</Field>
              <Field label="Added">{shortDate(u.createdAt)}</Field>
            </div>
            <p className="mt-auto pt-5 text-caption-xs text-gray-400">Last updated {shortDate(u.updatedAt)}</p>
          </Panel>
        </div>

        {/* ── Recent tickets ─────────────────────────────────────── */}
        <Panel
          icon={Ticket}
          title="Recent tickets"
          caption="Maintenance raised from this unit"
          className="mt-6"
          right={
            u.recentTickets.length > 0 ? (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-caption-xs font-semibold text-gray-600">
                {u.recentTickets.length}
              </span>
            ) : undefined
          }
        >
          {u.recentTickets.length > 0 ? (
            <div className="-mx-5 -my-5 divide-y divide-gray-100">
              {u.recentTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => router.push(`/dashboard/admin/tickets?id=${ticket.id}`)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent-50/40"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
                    <Ticket className="h-4 w-4 text-accent-600" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-medium text-gray-900 transition-colors group-hover:text-accent-700">
                      {ticket.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-caption-xs text-gray-500">
                      <CalendarDays className="h-3 w-3 text-gray-400" />
                      {shortDate(ticket.createdAt)}
                    </span>
                  </span>
                  <StatusBadge variant={ticketVariant(ticket.status)} dot={false}>
                    {ticket.status.replace(/_/g, ' ')}
                  </StatusBadge>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-50">
                <Ticket className="h-5 w-5 text-accent-500" />
              </div>
              <p className="text-body-sm font-medium text-gray-600">No tickets from this unit</p>
              <p className="mt-0.5 max-w-[18rem] text-caption-xs leading-relaxed text-gray-400">
                Anything a resident reports from Unit {u.unitNumber} shows up here.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Transfer clearance dialog ──────────────────────────── */}
      <Modal
        open={showTransfer}
        onClose={closeTransfer}
        icon={ArrowRightLeft}
        title="Transfer clearance"
        subtitle={`Unit ${u.unitNumber} · ${u.buildingName}`}
        size="lg"
        footer={
          transferCheck ? (
            <>
              <button
                onClick={closeTransfer}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteTransfer}
                disabled={!transferCheck.canTransfer || completingTransfer}
                className={`flex-[1.3] rounded-xl py-2.5 text-body-sm font-medium transition-all ${
                  transferCheck.canTransfer
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400'
                }`}
              >
                {completingTransfer
                  ? 'Completing...'
                  : transferCheck.canTransfer
                    ? 'Complete transfer'
                    : 'Settle dues first'}
              </button>
            </>
          ) : undefined
        }
      >
        {transferLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        ) : transferCheck ? (
          <div className="space-y-4">
            <p className="text-body-sm leading-relaxed text-gray-500">
              Moving out clears this unit: active members are deactivated and the primary contact is removed.
              Anything outstanding has to be settled first.
            </p>

            {/* Dues */}
            {transferCheck.unpaidCount > 0 ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <h4 className="text-body-sm font-semibold text-red-700">
                    {transferCheck.unpaidCount} unpaid invoice{transferCheck.unpaidCount > 1 ? 's' : ''}
                  </h4>
                  <span className="ml-auto text-body-sm font-semibold text-red-700">
                    {formatPaisa(transferCheck.unpaidTotal)}
                  </span>
                </div>
                <p className="mt-2 text-caption text-red-600">
                  All dues must be settled before a transfer can be completed.
                </p>
                <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                  {transferCheck.unpaidInvoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-white px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-medium text-gray-900">{inv.title}</p>
                        <p className="text-caption-xs text-gray-500">
                          {inv.invoiceNumber} &middot; Due {shortDate(inv.dueDate)}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-body-sm font-semibold text-red-600">
                        {formatPaisa(inv.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push('/dashboard/admin/invoices')}
                  className="mt-3 inline-flex items-center gap-1.5 text-caption font-semibold text-red-600 transition-colors hover:text-red-700"
                >
                  Go to invoices <ArrowRightLeft className="h-3 w-3 rotate-45" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                <div>
                  <p className="text-body-sm font-semibold text-emerald-700">All dues settled</p>
                  <p className="text-caption-xs text-emerald-600">No outstanding invoices. The transfer can proceed.</p>
                </div>
              </div>
            )}

            {/* Members to deactivate */}
            {transferCheck.activeMembers.length > 0 && (
              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/60 p-4">
                <p className="text-body-sm font-medium text-gray-700">
                  {transferCheck.activeMembers.length} active member
                  {transferCheck.activeMembers.length > 1 ? 's' : ''} will be deactivated
                </p>
                <div className="mt-3 space-y-2">
                  {transferCheck.activeMembers.map((m: any) => (
                    <div key={m.membershipId} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white text-caption-xs font-semibold text-gray-500 ring-1 ring-gray-200">
                        {initials(m.name)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body-sm text-gray-700">{m.name}</span>
                      <span className="flex-shrink-0 text-caption-xs text-gray-500">{roleLabel(m.role)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary contact */}
            {transferCheck.primaryContactName && (
              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/60 p-4">
                <p className="text-body-sm font-medium text-gray-700">Primary contact will be cleared</p>
                <p className="mt-1 text-body-sm text-gray-600">
                  {transferCheck.primaryContactName}
                  {transferCheck.primaryContactEmail ? ` (${transferCheck.primaryContactEmail})` : ''}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
