'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, User, Mail, Home, Building2, Ticket, FileText, Calendar } from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';

const BEDROOM_TYPES: Record<string, string> = {
  STUDIO: 'Studio',
  ONE_BED: '1 Bedroom',
  TWO_BED: '2 Bedrooms',
  THREE_BED: '3 Bedrooms',
  FOUR_BED: '4 Bedrooms',
  FOUR_PLUS_BED: '4+ Bedrooms',
};

// Ringed status pills, matching the card system used across the dashboard.
const TICKET_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-700 ring-amber-200/70',
  ASSIGNED: 'bg-accent-50 text-accent-700 ring-accent-200/70',
  IN_PROGRESS: 'bg-purple-50 text-purple-700 ring-purple-200/70',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  CLOSED: 'bg-gray-100 text-gray-600 ring-gray-200/70',
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-200/70',
  ISSUED: 'bg-accent-50 text-accent-700 ring-accent-200/70',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  OVERDUE: 'bg-red-50 text-red-700 ring-red-200/70',
  CANCELLED: 'bg-gray-100 text-gray-500 ring-gray-200/70',
  DISPUTED: 'bg-amber-50 text-amber-700 ring-amber-200/70',
};

const ROLE_STYLES: Record<string, { label: string; className: string }> = {
  COMMITTEE_ADMIN: { label: 'Committee Admin', className: 'bg-purple-50 text-purple-700 ring-purple-200/70' },
  RESIDENT: { label: 'Resident', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70' },
  SECURITY_GUARD: { label: 'Security Guard', className: 'bg-amber-50 text-amber-700 ring-amber-200/70' },
  VENDOR: { label: 'Vendor', className: 'bg-accent-50 text-accent-700 ring-accent-200/70' },
};

/** "IN_PROGRESS" -> "In progress" */
const humanise = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function SectionHeading({
  icon: Icon,
  title,
  meta,
  action,
}: {
  icon: React.ElementType;
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
        <Icon className="w-4 h-4 text-accent-600" />
      </div>
      <h2 className="text-title-sm font-display text-gray-900">{title}</h2>
      {meta && <span className="text-caption-xs text-gray-400">{meta}</span>}
      <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
      {action}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</dt>
      <dd className="mt-1.5 flex items-center gap-1.5 text-body-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-10">
      <Icon className="w-5 h-5 text-gray-300" />
      <p className="text-body-sm text-gray-400">{text}</p>
    </div>
  );
}

interface ResidentDetail {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  role: string;
  membershipId: string;
  unit: {
    id: string;
    unitNumber: string;
    floor: number;
    bedroomType: string | null;
    buildingId: string;
    buildingName: string;
  } | null;
  recentTickets: {
    id: string;
    title: string;
    status: string;
    category: string;
    createdAt: string;
  }[];
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    title: string;
    amount: number;
    status: string;
    dueDate: string;
    createdAt: string;
  }[];
  ticketStats: {
    status: string;
    count: number;
  }[];
}

export default function ResidentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [resident, setResident] = useState<ResidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    auth.me().catch(() => router.push('/login'));
    fetchResident();
  }, [router, userId]);

  const fetchResident = async () => {
    try {
      const data = await apiGet<ResidentDetail>(`/api/v1/directory/${userId}`);
      setResident(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load resident');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return `Rs ${(amount / 100).toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading resident...</p>
        </div>
      </div>
    );
  }

  if (error || !resident) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/dashboard/admin/directory')} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-500 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-display font-bold text-gray-900">Resident</h1>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-body-sm text-red-700">
            {error || 'Resident not found'}
          </div>
        </div>
      </div>
    );
  }

  // Derived figures
  const totalTickets = resident.ticketStats.reduce((sum, s) => sum + s.count, 0);
  const openTickets =
    resident.ticketStats
      .filter((s) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(s.status))
      .reduce((sum, s) => sum + s.count, 0);
  const role = ROLE_STYLES[resident.role] || { label: humanise(resident.role), className: 'bg-gray-100 text-gray-600 ring-gray-200/70' };
  const initials = resident.name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/admin/directory')}
            aria-label="Back to directory"
            className="p-2 rounded-xl text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-300/60 shadow-[0_12px_26px_-14px_rgba(37,99,235,1)]">
            <span className="font-display text-lg font-bold tracking-wide text-white">{initials || '?'}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-display font-bold text-gray-900 truncate">{resident.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${role.className}`}>
                {role.label}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                {resident.email}
              </span>
              <span className="text-gray-300" aria-hidden="true">&middot;</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Joined {formatDate(resident.joinedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Ticket, label: 'Total tickets', value: totalTickets, color: 'text-accent-600', bg: 'bg-accent-50' },
            { icon: Ticket, label: 'Open tickets', value: openTickets, color: 'text-amber-600', bg: 'bg-amber-50' },
            { icon: FileText, label: 'Recent invoices', value: resident.recentInvoices.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{stat.label}</span>
              </div>
              <p className="text-display font-display text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── Profile ────────────────────────────────────────────────── */}
        <section className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <SectionHeading icon={User} title="Profile" />
          <dl className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
            <Field label="Full name">{resident.name}</Field>
            <Field label="Email">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              {resident.email}
            </Field>
            <Field label="Role">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${role.className}`}>
                {role.label}
              </span>
            </Field>
            <Field label="Member since">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {formatDate(resident.joinedAt)}
            </Field>
          </dl>
        </section>

        {/* ── Unit ───────────────────────────────────────────────────── */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="p-6">
            <SectionHeading icon={Home} title="Unit" />
            {resident.unit ? (
              <div className="flex flex-wrap items-start gap-5">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-300/60">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Unit number</p>
                  <p className="text-display font-display text-gray-900">{resident.unit.unitNumber}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/admin/buildings/${resident.unit!.buildingId}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-caption-xs text-gray-600 ring-1 ring-gray-200/70 transition-colors hover:bg-accent-50 hover:text-accent-700 hover:ring-accent-200/70"
                    >
                      <Building2 className="w-3 h-3 text-gray-400" />
                      {resident.unit.buildingName}
                    </button>
                    <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 text-caption-xs text-gray-600 ring-1 ring-gray-200/70">
                      Floor {resident.unit.floor}
                    </span>
                    <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 text-caption-xs text-gray-600 ring-1 ring-gray-200/70">
                      {resident.unit.bedroomType ? BEDROOM_TYPES[resident.unit.bedroomType] || resident.unit.bedroomType : 'Bedrooms not specified'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/admin/units/${resident.unit!.id}`)}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3.5 py-2 text-body-sm font-medium text-accent-700 transition-all hover:bg-accent-100"
                >
                  View unit
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <EmptyRow icon={Home} text="No unit assigned yet" />
            )}
          </div>
        </section>

        {/* ── Recent tickets ─────────────────────────────────────────── */}
        <section className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <SectionHeading
            icon={Ticket}
            title="Recent tickets"
            meta={resident.recentTickets.length > 0 ? `Last ${resident.recentTickets.length}` : undefined}
          />
          {resident.recentTickets.length === 0 ? (
            <EmptyRow icon={Ticket} text="No maintenance tickets raised" />
          ) : (
            <div className="space-y-2.5">
              {resident.recentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 transition-colors hover:border-accent-200 hover:bg-white"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200/80">
                    <Ticket className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-gray-900">{ticket.title}</p>
                    <p className="mt-0.5 text-caption-xs text-gray-400">
                      {humanise(ticket.category)}
                      {' '}&middot;{' '}
                      {formatDate(ticket.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                      TICKET_STATUS_STYLES[ticket.status] || 'bg-gray-100 text-gray-600 ring-gray-200/70'
                    }`}
                  >
                    {humanise(ticket.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Recent invoices ────────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <SectionHeading icon={FileText} title="Recent invoices" />
          {resident.recentInvoices.length === 0 ? (
            <EmptyRow icon={FileText} text="No invoices issued yet" />
          ) : (
            <div className="space-y-2.5">
              {resident.recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 transition-colors hover:border-accent-200 hover:bg-white"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200/80">
                    <FileText className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-gray-900">{invoice.title}</p>
                    <p className="mt-0.5 text-caption-xs text-gray-400">
                      {invoice.invoiceNumber}
                      {' '}&middot;{' '}
                      Due {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="text-body-sm font-semibold tabular-nums text-gray-900">{formatAmount(invoice.amount)}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                        INVOICE_STATUS_STYLES[invoice.status] || 'bg-gray-100 text-gray-600 ring-gray-200/70'
                      }`}
                    >
                      {humanise(invoice.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
