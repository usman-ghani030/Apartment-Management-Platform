'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Wrench, ChevronRight, Send, UserPlus, Star, X, Calendar,
  Home, MessageSquare, AlertTriangle, User, CheckCircle2, Play, MessageCircle, Phone,
} from 'lucide-react';
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api';
import { VendorCombobox } from '@/components/ui/VendorCombobox';
import {
  buildWhatsAppLink,
  normalizePakistaniPhone,
  VENDOR_CONTACT_ERROR,
} from '@apartment/shared';
import type {
  TicketResponse,
  VendorRatingSummary,
  VendorSearchResult,
  VendorCreateResult,
} from '@apartment/shared';

// ── Status presentation ────────────────────────────────────────────────
// Ringed pills sit on white cards; each status also drives its card accent.
const STATUS_STYLES: Record<string, { pill: string; bar: string; chip: string }> = {
  OPEN: {
    pill: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    bar: 'bg-amber-400',
    chip: 'from-amber-400 to-amber-500 ring-amber-200',
  },
  ASSIGNED: {
    pill: 'bg-accent-50 text-accent-700 ring-accent-200/70',
    bar: 'bg-accent-500',
    chip: 'from-accent-500 to-accent-600 ring-accent-200',
  },
  IN_PROGRESS: {
    pill: 'bg-purple-50 text-purple-700 ring-purple-200/70',
    bar: 'bg-purple-500',
    chip: 'from-purple-500 to-purple-600 ring-purple-200',
  },
  RESOLVED: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    bar: 'bg-emerald-500',
    chip: 'from-emerald-500 to-emerald-600 ring-emerald-200',
  },
  CLOSED: {
    pill: 'bg-gray-100 text-gray-600 ring-gray-200/70',
    bar: 'bg-gray-300',
    chip: 'from-gray-400 to-gray-500 ring-gray-200',
  },
};

const FALLBACK_STATUS = {
  pill: 'bg-gray-100 text-gray-600 ring-gray-200/70',
  bar: 'bg-gray-300',
  chip: 'from-gray-400 to-gray-500 ring-gray-200',
};

const NEXT_STATUS: Record<string, string[]> = {
  OPEN: ['ASSIGNED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

// A transition reads better as the action it performs than as the state it sets.
const TRANSITIONS: Record<string, { label: string; icon: React.ElementType; tone: 'calm' | 'good' | 'stop' }> = {
  ASSIGNED: { label: 'Mark assigned', icon: UserPlus, tone: 'calm' },
  IN_PROGRESS: { label: 'Start work', icon: Play, tone: 'calm' },
  RESOLVED: { label: 'Mark resolved', icon: CheckCircle2, tone: 'good' },
  CLOSED: { label: 'Close & rate', icon: X, tone: 'stop' },
};

const FILTERS = ['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const humanise = (value: string) =>
  value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const statusPill = (status: string) => (STATUS_STYLES[status] || FALLBACK_STATUS).pill;

/**
 * What actually happened to the vendor's job link. `manual` is the important
 * one: the link exists but nothing was sent, so the admin has to hand it over
 * on WhatsApp - the UI must say so rather than imply the vendor was notified.
 */
type AssignNotice = { tone: 'sent' | 'manual' | 'none'; text: string };

/** Small uppercase heading that opens each detail card. */
function CardHeading({ icon: Icon, title, meta, action }: {
  icon: React.ElementType;
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 ring-1 ring-accent-100">
        <Icon className="w-4 h-4 text-accent-600" />
      </div>
      <h2 className="text-title-sm font-display text-gray-900">{title}</h2>
      {meta}
      <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
      {action}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 w-4 h-4 flex-shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
        <p className="mt-0.5 truncate text-body-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<TicketResponse | null>(null);
  const [comment, setComment] = useState('');
  // Vendor assignment: the selected Vendor record (never a raw string - the
  // ticket is always assigned by vendorId), the inline "add new vendor" draft,
  // the email the job link is sent to, and the magic-link URL issued by the last
  // assignment (used verbatim by the manual WhatsApp button).
  const [selectedVendor, setSelectedVendor] = useState<VendorSearchResult | null>(null);
  const [creatingVendor, setCreatingVendor] = useState<string | null>(null);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  // Vendor magic link: the email the job link is sent to, plus UI state for
  // reassignment and the outcome of the last assignment. `assignNotice` mirrors
  // `vendorLinkSent`: a vendor with no email was never emailed, and saying "email
  // sent" (or nothing at all) would leave the admin assuming a notification
  // happened when the hand-off is still on them.
  const [assignEmail, setAssignEmail] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [assignNotice, setAssignNotice] = useState<AssignNotice | null>(null);
  const [error, setError] = useState('');
  // Vendor ratings (Phase 7 slice 3)
  const [vendorRatings, setVendorRatings] = useState<VendorRatingSummary[]>([]);
  const [closeRating, setCloseRating] = useState(0);
  const [closeComment, setCloseComment] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closing, setClosing] = useState(false);

  const fetchVendorRatings = useCallback(async () => {
    try {
      const data = await apiGet<VendorRatingSummary[]>('/api/v1/tickets/vendor-ratings');
      setVendorRatings(data || []);
    } catch {
      // Best-effort - the panel is hidden when ratings can't load.
    }
  }, []);

  useEffect(() => { fetchVendorRatings(); }, [fetchVendorRatings]);

  // Look up a vendor's rating by name (case-insensitive) for inline display.
  const ratingFor = (name: string) =>
    vendorRatings.find((v) => v.vendorName.toLowerCase() === name.trim().toLowerCase()) || null;

  const fetchTickets = useCallback(async () => {
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : '';
      const data = await apiGet<TicketResponse[]>(`/api/v1/tickets${params}`);
      setTickets(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router, filter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const viewTicket = async (id: string) => {
    try {
      setSelected(await apiGet<TicketResponse>(`/api/v1/tickets/${id}`));
      setSelectedVendor(null);
      setCreatingVendor(null);
      setNewVendorName('');
      setNewVendorPhone('');
      setNewVendorEmail('');
      setWhatsappUrl(null);
      setAssignEmail('');
      setReassigning(false);
      setAssignNotice(null);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const changeStatus = async (id: string, status: string, extra: Record<string, unknown> = {}) => {
    try {
      await apiPatch(`/api/v1/tickets/${id}`, { status, ...extra });
      setError('');
      if (selected && selected.id === id) {
        viewTicket(id);
        fetchVendorRatings();
      } else {
        fetchTickets();
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  // Close flow with vendor rating: opens the rating form, then closes with the
  // chosen stars + optional comment.
  const startClose = () => {
    setCloseRating(0);
    setCloseComment('');
    setShowCloseForm(true);
  };

  const confirmClose = async () => {
    if (!selected || closeRating === 0) return;
    setClosing(true);
    await changeStatus(selected.id, 'CLOSED', { rating: closeRating, ratingComment: closeComment.trim() || null });
    setClosing(false);
    setShowCloseForm(false);
  };

  // The ticket is assigned by vendorId - the vendor is always a real Vendor
  // record (picked from the dropdown or created inline a moment earlier).
  const handleAssign = async (id: string, vendorOverride?: VendorSearchResult | null) => {
    const vendor = vendorOverride !== undefined ? vendorOverride : selectedVendor;
    if (!vendor) {
      setError('Choose a vendor (or add a new one) before assigning.');
      return;
    }
    setAssigning(true);
    const email = assignEmail.trim();
    try {
      const payload: Record<string, unknown> = { vendorId: vendor.id };
      if (email) payload.vendorEmail = email;
      // Only the first assignment moves the ticket out of OPEN - on reassignment
      // the ticket has already progressed and the status must be left alone.
      if (selected?.status === 'OPEN') payload.status = 'ASSIGNED';

      const updated = await apiPatch<TicketResponse>(`/api/v1/tickets/${id}`, payload);
      setError('');
      await viewTicket(id);
      // The magic-link URL is returned only by the response that issued it; the
      // WhatsApp button reuses exactly this URL (never a second token).
      setWhatsappUrl(updated.vendorTicketUrl ?? null);

      // Three genuinely different outcomes - never collapse them into one
      // reassuring message:
      //   emailed        -> the vendor has been notified, nothing more to do
      //   link, no email -> a phone-only vendor: hand the link over on WhatsApp
      //   no link at all -> no contact method, so no notification of any kind
      const phone = updated.vendorPhone || vendor.phone;
      if (updated.vendorLinkSent) {
        setAssignNotice({
          tone: 'sent',
          text: `Assigned to ${vendor.name} - the job link was emailed to ${email || vendor.email}.`,
        });
      } else if (updated.vendorTicketUrl && phone) {
        setAssignNotice({
          tone: 'manual',
          text: `Assigned to ${vendor.name}. ${vendor.name} has no email, so nothing was sent automatically - use "Message on WhatsApp" below to hand over the job link.`,
        });
      } else {
        setAssignNotice({
          tone: 'none',
          text: `Assigned to ${vendor.name}, but there is no email or phone on file - the job link could not be sent to anyone. Add a contact method to this vendor and reassign to notify them.`,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  // "Add '<typed>' as new vendor" from the dropdown: prefill whichever half the
  // admin typed and ask for the rest, without leaving the assignment form.
  const startNewVendor = (typed: string) => {
    const looksLikePhone = /^[+\d][\d\s()+-]*$/.test(typed);
    const looksLikeEmail = typed.includes('@');
    setNewVendorName(looksLikePhone || looksLikeEmail ? '' : typed);
    setNewVendorPhone(looksLikePhone ? typed : '');
    setNewVendorEmail(looksLikeEmail ? typed : '');
    setCreatingVendor(typed);
    setAssignNotice(null);
    setError('');
  };

  // Mirror of the backend rule: a vendor needs a name plus *at least one* of
  // email/phone. The backend stays the source of truth (it is the only thing
  // that can be trusted) - this check exists so the admin sees the problem
  // immediately instead of after a round trip.
  const newVendorPhoneValid = Boolean(normalizePakistaniPhone(newVendorPhone));
  const newVendorEmailFilled = Boolean(newVendorEmail.trim());
  const newVendorHasContact = newVendorPhoneValid || newVendorEmailFilled;

  const createVendorAndAssign = async () => {
    if (!selected) return;
    const name = newVendorName.trim();
    if (!name) {
      setError('Vendor name is required.');
      return;
    }
    // A typed-but-invalid phone is an error (not a silent skip): the admin
    // clearly meant to give us that number, and a blank email would then let a
    // typo through as "email-only vendor".
    if (newVendorPhone.trim() && !newVendorPhoneValid) {
      setError('That mobile number is not a valid Pakistani number (e.g. 0300 1234567).');
      return;
    }
    if (!newVendorHasContact) {
      setError(VENDOR_CONTACT_ERROR);
      return;
    }
    setSavingVendor(true);
    try {
      // Same endpoint (and same validation) as creating a vendor anywhere else.
      const vendor = await apiPost<VendorCreateResult>('/api/v1/vendors', {
        name,
        phone: newVendorPhone.trim() || null,
        email: newVendorEmail.trim() || null,
      });
      setCreatingVendor(null);
      setError('');
      // Immediately assignable in the same action - no reload, no second step.
      await handleAssign(selected.id, vendor);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSavingVendor(false);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !comment.trim()) return;
    try {
      await apiPost(`/api/v1/tickets/${selected.id}/comments`, { content: comment });
      setComment('');
      viewTicket(selected.id);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading tickets...</p>
        </div>
      </div>
    );
  }

  /* ────────────────────────────── Ticket detail ────────────────────── */
  if (selected) {
    const style = STATUS_STYLES[selected.status] || FALLBACK_STATUS;
    let photos: string[] = [];
    if (selected.photosUrl) {
      try {
        const parsed = JSON.parse(selected.photosUrl);
        if (Array.isArray(parsed)) photos = parsed;
      } catch { /* malformed photo payload - just render no gallery */ }
    }
    const transitions = NEXT_STATUS[selected.status] || [];

    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
        <main className="max-w-6xl mx-auto px-6 py-8">
          <button
            onClick={() => { setSelected(null); fetchTickets(); }}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-body-sm font-medium text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to tickets
          </button>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
            {/* ── Main column ─────────────────────────────────────── */}
            <div className="space-y-6 lg:col-span-2">
              {/* Summary */}
              <section className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <span className={`absolute inset-x-0 top-0 h-1 ${style.bar}`} aria-hidden="true" />
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${style.chip} ring-1`}>
                    <Wrench className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-title font-display text-gray-900">{selected.title}</h1>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${style.pill}`}>
                        {humanise(selected.status)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-body-sm text-gray-500">
                      {humanise(selected.category)}
                      {' '}&middot;{' '}
                      {selected.residentName}
                      {' '}&middot;{' '}
                      Unit {selected.unitNumber || 'N/A'}
                      {' '}&middot;{' '}
                      {formatDate(selected.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Reported</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-body-sm leading-relaxed text-gray-700">{selected.description}</p>
                </div>
              </section>

              {/* Photos */}
              {photos.length > 0 && (
                <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                  <CardHeading
                    icon={Home}
                    title="Photos"
                    meta={<span className="text-caption-xs text-gray-400">{photos.length}</span>}
                  />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block aspect-video overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50"
                      >
                        <img
                          src={url}
                          alt={`Ticket photo ${i + 1}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Timeline */}
              <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <CardHeading
                  icon={MessageSquare}
                  title="Timeline"
                  meta={
                    <span className="text-[11px] font-semibold tabular-nums rounded-full bg-accent-50 px-2 py-0.5 text-accent-700 ring-1 ring-accent-200/60">
                      {selected.comments?.length || 0}
                    </span>
                  }
                />

                {selected.comments && selected.comments.length > 0 ? (
                  <div className="space-y-3">
                    {selected.comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-50 ring-1 ring-accent-100">
                          <span className="text-[11px] font-semibold text-accent-700">
                            {c.authorName?.trim()?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-gray-100 bg-gray-50/60 px-3.5 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-body-sm font-medium text-gray-900">{c.authorName}</span>
                            <span className="text-caption-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-1 text-body-sm text-gray-700">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-8">
                    <MessageSquare className="w-5 h-5 text-gray-300" />
                    <p className="text-body-sm text-gray-400">No updates yet. Add the first one below.</p>
                  </div>
                )}

                <form onSubmit={addComment} className="mt-4 flex gap-2">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add an update for the team and the vendor..."
                    maxLength={2000}
                    className="flex-1 rounded-xl border border-gray-200/80 bg-gray-50 px-4 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                  />
                  <button
                    type="submit"
                    aria-label="Post update"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-accent-700 shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Post</span>
                  </button>
                </form>
              </section>
            </div>

            {/* ── Side column ─────────────────────────────────────── */}
            <div className="space-y-6">
              {/* Status actions */}
              <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <CardHeading icon={Wrench} title="Status" />
                {transitions.length > 0 ? (
                  <div className="space-y-2">
                    {transitions.map((s) => {
                      const cfg = TRANSITIONS[s] || { label: humanise(s), icon: CheckCircle2, tone: 'calm' as const };
                      const Icon = cfg.icon;
                      const tone =
                        cfg.tone === 'good'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : cfg.tone === 'stop'
                            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                            : 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100';
                      return (
                        <button
                          key={s}
                          onClick={() => (s === 'CLOSED' ? startClose() : changeStatus(selected.id, s))}
                          className={`flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-body-sm font-medium transition-all ${tone}`}
                        >
                          <Icon className="w-4 h-4" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-3 text-body-sm text-gray-500">
                    This ticket is closed. No further status changes.
                  </p>
                )}

                {/* Close-with-rating form */}
                {showCloseForm && (
                  <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/60 p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-body-sm font-semibold text-gray-900">Rate the vendor before closing</p>
                        <p className="mt-0.5 text-caption-xs text-gray-500">Ratings build the vendor scoreboard.</p>
                      </div>
                      <button
                        onClick={() => setShowCloseForm(false)}
                        aria-label="Cancel rating"
                        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-amber-100 hover:text-gray-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mb-3 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCloseRating(n)}
                          aria-label={`${n} star${n === 1 ? '' : 's'}`}
                          className="p-0.5 transition-transform hover:scale-110"
                        >
                          <Star className={`w-6 h-6 ${n <= closeRating ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`} />
                        </button>
                      ))}
                      {closeRating > 0 && (
                        <span className="ml-2 text-caption-xs font-semibold text-gray-600">{closeRating}/5</span>
                      )}
                    </div>
                    <input
                      value={closeComment}
                      onChange={(e) => setCloseComment(e.target.value)}
                      placeholder="Optional comment on the vendor's work..."
                      maxLength={500}
                      className="mb-3 w-full rounded-xl border border-amber-200/70 bg-white px-3.5 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={confirmClose}
                        disabled={closeRating === 0 || closing}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                      >
                        <Star className="w-3.5 h-3.5" />
                        {closing ? 'Closing...' : `Close & rate ${closeRating || ''} star${closeRating === 1 ? '' : 's'}`}
                      </button>
                      <button
                        onClick={() => setShowCloseForm(false)}
                        className="rounded-xl px-3 py-2.5 text-body-sm font-medium text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing rating on a closed ticket */}
                {selected.rating != null && (
                  <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/60 p-4">
                    <div className="mb-1 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`w-4 h-4 ${n <= selected.rating! ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`} />
                      ))}
                      <span className="ml-2 text-body-sm font-semibold text-gray-900">{selected.rating}/5</span>
                    </div>
                    {selected.ratingComment && (
                      <p className="text-body-sm italic text-gray-700">&ldquo;{selected.ratingComment}&rdquo;</p>
                    )}
                    <p className="mt-1 text-caption-xs text-gray-500">
                      Rated by {selected.ratedByName || 'admin'}
                      {selected.ratedAt ? ` on ${formatDate(selected.ratedAt)}` : ''}
                    </p>
                  </div>
                )}
              </section>

              {/* Vendor / assignment */}
              <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <CardHeading icon={UserPlus} title="Vendor" />

                {selected.assignedTo && !reassigning ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-accent-100 bg-accent-50/70 p-3.5">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-300/60">
                        <Wrench className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-semibold text-gray-900">{selected.assignedTo}</p>
                        <p className="flex items-center gap-1 truncate text-caption-xs text-gray-500">
                          {selected.vendorPhone && <Phone className="w-3 h-3 flex-shrink-0 text-gray-400" />}
                          {selected.vendorPhone || selected.vendorEmail || 'No contact on file'}
                        </p>
                      </div>
                      {ratingFor(selected.assignedTo) && (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/70">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          {ratingFor(selected.assignedTo)!.avgRating.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/*
                      Manual WhatsApp hand-off. The link reuses the exact magic
                      link emailed at assignment time; nothing is sent by the
                      backend - the admin clicks, WhatsApp opens pre-filled.
                    */}
                    {/*
                      A phone-only vendor was never emailed - say so, right above
                      the button, so the admin's next action is obvious instead of
                      assuming the vendor has already been told about the job.
                    */}
                    {whatsappUrl && selected.vendorPhone && !selected.vendorEmail && (
                      <p className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3.5 py-2.5 text-caption-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                        <span>
                          No email on file - nothing has been sent to {selected.assignedTo}{' '}
                          automatically. Send the job link now:
                        </span>
                      </p>
                    )}

                    {selected.vendorPhone && whatsappUrl ? (
                      <a
                        href={buildWhatsAppLink(
                          selected.vendorPhone,
                          [
                            `Hello ${selected.assignedTo ?? 'there'}, a maintenance job has been assigned to you.`,
                            '',
                            `Ticket ${selected.ticketRef} - ${selected.title}`,
                            '',
                            `View the job and update its status: ${whatsappUrl}`,
                          ].join('\n')
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-emerald-700"
                      >
                        <MessageCircle className="w-4 h-4" /> Message on WhatsApp
                      </a>
                    ) : selected.vendorPhone ? (
                      <p className="rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-2.5 text-caption-xs text-gray-500">
                        WhatsApp number on file. The job link is only shown right after an
                        assignment (it is never stored), so reassign to generate a fresh link
                        you can send.
                      </p>
                    ) : selected.vendorEmail ? null : (
                      // Defensive: unreachable through the vendor form, which requires a
                      // contact method, but a row can predate that rule - never leave the
                      // admin assuming a notification went out.
                      <p className="flex items-start gap-2 rounded-xl border border-red-200/70 bg-red-50 px-3.5 py-2.5 text-caption-xs text-red-700">
                        <AlertTriangle className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-red-600" />
                        <span>
                          This vendor has no email and no phone on file, so no job link could be
                          sent. Add a contact method, then reassign to notify them.
                        </span>
                      </p>
                    )}

                    {selected.status !== 'CLOSED' && (
                      <button
                        onClick={() => {
                          setSelectedVendor(null);
                          setAssignEmail(selected.vendorEmail || '');
                          setReassigning(true);
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Reassign vendor
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-body-sm font-medium text-gray-700" htmlFor="vendor-search">Vendor</label>
                      <VendorCombobox
                        selected={selectedVendor}
                        onSelect={(v) => {
                          setSelectedVendor(v);
                          if (v) setAssignEmail(v.email || '');
                        }}
                        onCreateRequest={startNewVendor}
                        disabled={assigning || savingVendor}
                      />
                      <p className="mt-1.5 text-caption-xs text-gray-400">
                        Search your vendor directory by name or phone - or add a new one without
                        leaving this screen.
                      </p>
                    </div>

                    {selectedVendor && (
                      <div>
                        <label className="mb-1.5 block text-body-sm font-medium text-gray-700" htmlFor="vendor-email">Job link email</label>
                        <input
                          id="vendor-email"
                          value={assignEmail}
                          onChange={(e) => setAssignEmail(e.target.value)}
                          type="email"
                          placeholder="vendor@example.com"
                          maxLength={200}
                          className="w-full rounded-xl border border-gray-200/80 bg-gray-50 px-3.5 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                        />
                        <p className="mt-1.5 text-caption-xs text-gray-400">
                          {selectedVendor.email
                            ? "The vendor's no-login job link is emailed here on save."
                            : 'No email on file - leave this blank to keep it that way and send the job link on WhatsApp instead.'}
                        </p>
                      </div>
                    )}

                    {selectedVendor && ratingFor(selectedVendor.name) && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/70">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        {ratingFor(selectedVendor.name)!.avgRating.toFixed(1)} from {ratingFor(selectedVendor.name)!.count} rating{ratingFor(selectedVendor.name)!.count === 1 ? '' : 's'}
                      </span>
                    )}

                    {creatingVendor && (
                      <div className="space-y-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-body-sm font-semibold text-gray-900">New vendor</p>
                            <p className="mt-0.5 text-caption-xs text-gray-500">
                              Saved to your directory and assigned in one step.
                            </p>
                          </div>
                          <button
                            onClick={() => setCreatingVendor(null)}
                            aria-label="Cancel new vendor"
                            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-emerald-100 hover:text-gray-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          value={newVendorName}
                          onChange={(e) => setNewVendorName(e.target.value)}
                          placeholder="Vendor name"
                          maxLength={100}
                          aria-label="New vendor name"
                          className="w-full rounded-xl border border-emerald-200/70 bg-white px-3.5 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                        />
                        <div>
                          <input
                            value={newVendorPhone}
                            onChange={(e) => setNewVendorPhone(e.target.value)}
                            placeholder="0300 1234567 (optional)"
                            maxLength={30}
                            aria-label="New vendor mobile number"
                            className="w-full rounded-xl border border-emerald-200/70 bg-white px-3.5 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                          />
                          <p className="mt-1.5 text-caption-xs text-gray-500">
                            {newVendorPhone.trim() && !newVendorPhoneValid
                              ? 'Not a valid Pakistani mobile - use 0300 1234567.'
                              : `Pakistani mobile number - stored as ${normalizePakistaniPhone(newVendorPhone) || '+92XXXXXXXXXX'}.`}
                          </p>
                        </div>
                        <input
                          value={newVendorEmail}
                          onChange={(e) => setNewVendorEmail(e.target.value)}
                          type="email"
                          placeholder="vendor@example.com (optional)"
                          maxLength={200}
                          aria-label="New vendor email"
                          className="w-full rounded-xl border border-emerald-200/70 bg-white px-3.5 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                        />

                        {/* The whole point of the relaxed rule: the admin needs to
                            see which channel they are (not) giving us, because it
                            decides whether the vendor is notified automatically. */}
                        <div className="rounded-xl border border-emerald-200/70 bg-white/70 px-3 py-2">
                          <p className={`text-caption-xs ${newVendorHasContact ? 'text-gray-600' : 'font-medium text-amber-700'}`}>
                            {newVendorPhoneValid && newVendorEmailFilled
                              ? 'Both channels on file - the job link is emailed automatically, and WhatsApp is available as a backup.'
                              : newVendorEmailFilled
                                ? 'Email only - the job link is emailed automatically. No WhatsApp button for this vendor.'
                                : newVendorPhoneValid
                                  ? 'Phone only - no email, so nothing is sent automatically. You will be prompted to send the job link on WhatsApp.'
                                  : VENDOR_CONTACT_ERROR}
                          </p>
                        </div>

                        <button
                          onClick={createVendorAndAssign}
                          disabled={savingVendor || assigning || !newVendorName.trim() || !newVendorHasContact}
                          title={!newVendorHasContact ? VENDOR_CONTACT_ERROR : undefined}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {savingVendor ? 'Saving...' : 'Save vendor & assign'}
                        </button>
                      </div>
                    )}

                    {selectedVendor && !creatingVendor && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAssign(selected.id)}
                          disabled={assigning}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent-600 px-3.5 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-accent-700 disabled:opacity-50"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {assigning ? 'Assigning...' : reassigning ? 'Reassign' : 'Assign vendor'}
                        </button>
                        {reassigning && (
                          <button
                            onClick={() => setReassigning(false)}
                            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Three outcomes, three appearances. "No email" is the one that
                    must not look like success: the job link still has to be sent
                    by hand, so this reads as an instruction, not a receipt. */}
                {assignNotice && (
                  <div
                    className={`mt-3 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 ${
                      assignNotice.tone === 'sent'
                        ? 'border-emerald-200/70 bg-emerald-50'
                        : assignNotice.tone === 'manual'
                          ? 'border-amber-200/70 bg-amber-50'
                          : 'border-red-200/70 bg-red-50'
                    }`}
                  >
                    {assignNotice.tone === 'sent' ? (
                      <CheckCircle2 className="mt-0.5 w-4 h-4 flex-shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className={`mt-0.5 w-4 h-4 flex-shrink-0 ${assignNotice.tone === 'manual' ? 'text-amber-600' : 'text-red-600'}`} />
                    )}
                    <p
                      className={`text-caption-xs ${
                        assignNotice.tone === 'sent'
                          ? 'text-emerald-700'
                          : assignNotice.tone === 'manual'
                            ? 'text-amber-800'
                            : 'text-red-700'
                      }`}
                    >
                      {assignNotice.text}
                    </p>
                  </div>
                )}
              </section>

              {/* Details */}
              <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <CardHeading icon={AlertTriangle} title="Details" />
                <div className="divide-y divide-gray-100">
                  <DetailRow icon={User} label="Raised by" value={selected.residentName} />
                  <DetailRow icon={Home} label="Unit" value={selected.unitNumber || 'N/A'} />
                  <DetailRow icon={Calendar} label="Raised on" value={formatDate(selected.createdAt)} />
                  <DetailRow icon={MessageSquare} label="Updates" value={`${selected.comments?.length || 0}`} />
                </div>
              </section>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-body-sm text-red-700">{error}</div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ────────────────────────────── Ticket list ─────────────────────── */
  const inView = tickets.length;
  const unassigned = tickets.filter((t) => !t.assignedTo).length;
  const assigned = tickets.filter((t) => t.assignedTo).length;
  const rated = tickets.filter((t) => t.rating != null).length;

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
            <h1 className="text-2xl font-display font-bold text-gray-900">Maintenance</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Every ticket raised by residents, from report to resolution.
            </p>
          </div>
        </div>

        {/* Stats */}
        {tickets.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: Wrench, label: 'In view', value: inView, color: 'text-accent-600', bg: 'bg-accent-50' },
              { icon: AlertTriangle, label: 'Unassigned', value: unassigned, color: 'text-amber-600', bg: 'bg-amber-50' },
              { icon: UserPlus, label: 'With vendor', value: assigned, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { icon: Star, label: 'Rated', value: rated, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md"
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">{stat.label}</span>
                </div>
                <p className="text-display font-display text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Status filter */}
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
                {s === 'ALL' ? 'All' : humanise(s)}
                {active && <span className="text-[11px] font-semibold tabular-nums text-white/75">{tickets.length}</span>}
              </button>
            );
          })}
        </div>

        {/* Vendor ratings */}
        {vendorRatings.length > 0 && (
          <section className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeading
              icon={Star}
              title="Vendor ratings"
              meta={<span className="text-caption-xs text-gray-400">Average across closed tickets</span>}
            />
            <div className="flex flex-wrap gap-3">
              {vendorRatings.map((v) => (
                <div key={v.vendorName} className="flex items-center gap-2.5 rounded-xl border border-gray-200/80 bg-gray-50/60 px-3.5 py-2.5">
                  <span className="text-body-sm font-medium text-gray-900">{v.vendorName}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/70">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                    {v.avgRating.toFixed(1)}
                  </span>
                  <span className="text-caption-xs text-gray-400">
                    {v.count} rating{v.count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* List */}
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <Wrench className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">
              {filter === 'ALL' ? 'No tickets yet' : `No ${humanise(filter).toLowerCase()} tickets`}
            </h3>
            <p className="mx-auto max-w-sm text-body-sm text-gray-500">
              {filter === 'ALL'
                ? 'Tickets raised by residents will appear here with photos, the assigned vendor and the full timeline.'
                : 'Try another status filter to see the rest of the queue.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const style = STATUS_STYLES[t.status] || FALLBACK_STATUS;
              return (
                <button
                  key={t.id}
                  onClick={() => viewTicket(t.id)}
                  className="group relative block w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-4 py-5 pl-6 pr-5">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${style.chip} ring-1 transition-transform duration-300 group-hover:scale-110`}>
                      <Wrench className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="truncate text-title-sm font-display text-gray-900 transition-colors duration-200 group-hover:text-accent-700">
                          {t.title}
                        </h3>
                        <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${style.pill}`}>
                          {humanise(t.status)}
                        </span>
                        {t.rating != null && (
                          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/70">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" /> {t.rating}/5
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <User className="w-3 h-3 text-gray-400" />
                          {t.residentName}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <Home className="w-3 h-3 text-gray-400" />
                          Unit {t.unitNumber || 'N/A'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs capitalize text-gray-500">
                          {humanise(t.category)}
                        </span>
                        {t.commentCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                            <MessageSquare className="w-3 h-3 text-gray-400" />
                            {t.commentCount}
                          </span>
                        )}
                        {t.assignedTo && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-caption-xs text-accent-700">
                            <Wrench className="w-3 h-3 text-accent-500" />
                            {t.assignedTo}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent-600" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
