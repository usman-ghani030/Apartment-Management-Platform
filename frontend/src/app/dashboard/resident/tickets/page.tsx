'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, ChevronRight, Wrench, ImagePlus, X, Send, MessageSquare,
  CalendarDays, Home, User as UserIcon, Check, Hourglass,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatTile, StatTileGrid } from '@/components/ui/StatTile';
import { Panel, CountPill, PanelEmpty } from '@/components/ui/Panel';
import { SearchField, FilterPills } from '@/components/ui/SearchField';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useSignedUpload } from '@/lib/useSignedUpload';
import type { TicketResponse } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Resident maintenance tickets: raise one, watch it move, and talk to whoever
// is working on it. Same endpoints and payloads as before, rebuilt on the
// dashboard design system.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC / AC' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'pest', label: 'Pest control' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

type BadgeVariant = 'warning' | 'info' | 'success' | 'neutral' | 'danger';

/** Status drives the rail, the pill and the progress strip - one source of truth. */
const STATUS_META: Record<string, { label: string; badge: BadgeVariant; rail: string; step: number }> = {
  OPEN: { label: 'Open', badge: 'warning', rail: 'bg-amber-400', step: 0 },
  ASSIGNED: { label: 'Assigned', badge: 'info', rail: 'bg-accent-500', step: 1 },
  IN_PROGRESS: { label: 'In progress', badge: 'info', rail: 'bg-accent-500', step: 1 },
  RESOLVED: { label: 'Resolved', badge: 'success', rail: 'bg-emerald-500', step: 2 },
  CLOSED: { label: 'Closed', badge: 'neutral', rail: 'bg-gray-300', step: 2 },
};

const metaFor = (status: string) =>
  STATUS_META[status] || { label: status.replace(/_/g, ' '), badge: 'neutral' as BadgeVariant, rail: 'bg-gray-300', step: 0 };

const STEPS = ['Raised', 'Working on it', 'Resolved'];

const categoryLabel = (c: string) =>
  CATEGORIES.find((x) => x.value === c)?.label || (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Other');

const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// ── Progress strip ─────────────────────────────────────────────────────
function ProgressStrip({ status }: { status: string }) {
  const step = metaFor(status).step;
  const closed = status === 'CLOSED';
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {STEPS.map((label, i) => {
        const done = i < step || (i === step && (step === 2 || closed));
        const current = i === step && !done;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-1 transition-colors ${
                done
                  ? 'bg-emerald-500 text-white ring-emerald-500'
                  : current
                    ? 'bg-accent-600 text-white ring-accent-600'
                    : 'bg-white text-gray-400 ring-gray-200'
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={`text-caption-xs font-medium ${done ? 'text-gray-700' : current ? 'text-accent-700' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-6 bg-gray-200" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function ResidentTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<TicketResponse | null>(null);
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Photos go straight to Cloudinary (ADR 002); the API only records the result.
  const { upload: uploadPhoto, uploading: uploadingPhotos, progress: photoProgress } =
    useSignedUpload();

  // Object URLs for the picked photo previews, kept per File so a removal
  // revokes exactly that one preview.
  const previewUrls = useRef<Map<File, string>>(new Map());
  const previewFor = (f: File) => {
    if (!previewUrls.current.has(f)) previewUrls.current.set(f, URL.createObjectURL(f));
    return previewUrls.current.get(f)!;
  };
  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const file = prev[index];
      const url = previewUrls.current.get(file);
      if (url) {
        URL.revokeObjectURL(url);
        previewUrls.current.delete(file);
      }
      return prev.filter((_, j) => j !== index);
    });
  };
  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await apiGet<TicketResponse[]>('/api/v1/tickets');
      setTickets(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openForm = () => {
    setShowForm(true);
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const ticket = await apiPost<TicketResponse>('/api/v1/tickets', { title, description, category });

      // Photos are uploaded straight to Cloudinary against the ticket that was
      // just created, then recorded on it by public id.
      if (photos.length > 0) {
        const uploaded = [];
        for (const file of photos) {
          uploaded.push(await uploadPhoto(file, 'ticket-photo', ticket.id));
        }
        await apiPost(`/api/v1/tickets/${ticket.id}/photos`, {
          publicIds: uploaded.map((a) => a.publicId),
        });
      }

      setTitle(''); setDescription(''); setCategory('other');
      setPhotos([]);
      setShowForm(false);
      fetchTickets();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const viewTicket = async (id: string) => {
    try {
      const data = await apiGet<TicketResponse>(`/api/v1/tickets/${id}`);
      setSelected(data);
    } catch { /* keep the list as-is if the detail fails to load */ }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !comment.trim()) return;
    setSendingComment(true);
    try {
      await apiPost(`/api/v1/tickets/${selected.id}/comments`, { content: comment });
      setComment('');
      viewTicket(selected.id);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSendingComment(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!q) return true;
    return [t.title, t.description, t.category, t.status].some((v) => (v || '').toLowerCase().includes(q));
  });

  const countOf = (statuses: string[]) => tickets.filter((t) => statuses.includes(t.status)).length;
  const openCount = countOf(['OPEN', 'ASSIGNED']);
  const workingCount = countOf(['IN_PROGRESS']);
  const doneCount = countOf(['RESOLVED', 'CLOSED']);

  if (loading) return <PageSkeleton width="max-w-5xl" />;

  // ── Ticket detail ────────────────────────────────────────────────────
  if (selected) {
    const meta = metaFor(selected.status);
    let photoList: string[] = [];
    if (selected.photosUrl) {
      try {
        const parsed = JSON.parse(selected.photosUrl);
        if (Array.isArray(parsed)) photoList = parsed.filter((u) => typeof u === 'string');
      } catch { /* photosUrl is optional and may not be JSON */ }
    }
    const comments = selected.comments || [];

    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <button
          onClick={() => { setSelected(null); fetchTickets(); }}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>

        {/* Summary */}
        <article className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" aria-hidden="true" />

          <header className="border-b border-gray-100 bg-gray-50/60 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-caption-xs font-medium capitalize text-gray-600 ring-1 ring-gray-200/80">
                {categoryLabel(selected.category)}
              </span>
              {selected.rating != null && (
                <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-caption-xs font-medium text-amber-700 ring-1 ring-amber-200">
                  Rated {selected.rating}/5
                </span>
              )}
            </div>

            <h1 className="mt-3.5 text-display-sm font-display leading-snug text-gray-900">{selected.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-caption-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-gray-400" /> {selected.residentName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5 text-gray-400" /> Unit {selected.unitNumber || 'not set'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" /> Raised {shortDate(selected.createdAt)}
              </span>
              {selected.assignedTo && (
                <span className="inline-flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5 text-gray-400" /> Assigned to {selected.assignedTo}
                </span>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-gray-200/80 bg-white px-4 py-3">
              <ProgressStrip status={selected.status} />
            </div>
          </header>

          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">What you reported</p>
            <p className="mt-2 whitespace-pre-wrap text-body leading-relaxed text-gray-700">{selected.description}</p>

            {photoList.length > 0 && (
              <div className="mt-6">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                  Photos ({photoList.length})
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photoList.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block aspect-video overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Ticket photo ${i + 1}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>

        {/* Timeline */}
        <Panel
          icon={MessageSquare}
          title="Timeline"
          hint="Updates from you and the maintenance team"
          meta={<CountPill>{comments.length} update{comments.length === 1 ? '' : 's'}</CountPill>}
          className="mt-6"
        >
          {comments.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-3.5 px-5 py-4">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-50 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-100">
                    {initials(c.authorName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-body-sm font-semibold text-gray-900">{c.authorName}</p>
                      <p className="text-caption-xs text-gray-400">{shortDateTime(c.createdAt)}</p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-body-sm leading-relaxed text-gray-600">{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty
              icon={Hourglass}
              title="No updates yet"
              description="Add anything that helps: access instructions, a good time to visit, or what you have already tried."
              compact
            />
          )}

          <form onSubmit={addComment} className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
            <label className="sr-only" htmlFor="ticket-comment">Add a comment</label>
            <textarea
              id="ticket-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment for the maintenance team..."
              maxLength={2000}
              rows={2}
              className="w-full resize-y rounded-xl border border-gray-200/80 bg-white px-4 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/10"
            />
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <p className="text-caption-xs text-gray-400">{comment.length}/2000</p>
              <button
                type="submit"
                disabled={!comment.trim() || sendingComment}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
              >
                <Send className="h-3.5 w-3.5" />
                {sendingComment ? 'Sending...' : 'Send update'}
              </button>
            </div>
          </form>
        </Panel>
      </div>
    );
  }

  // ── Ticket list ──────────────────────────────────────────────────────
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
              <Wrench className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-display-sm font-display text-gray-900">Maintenance</h1>
              <p className="text-body-sm text-gray-500">Raise a request and follow it through to resolved</p>
            </div>
          </div>
        </div>

        <button
          onClick={openForm}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:-translate-y-0.5 hover:bg-accent-700"
        >
          <Plus className="h-4 w-4" /> New ticket
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

      {tickets.length > 0 && (
        <StatTileGrid className="mb-6">
          <StatTile icon={Wrench} label="Open" value={openCount} hint={openCount === 0 ? 'Nothing waiting' : 'With the team'} />
          <StatTile icon={Hourglass} label="In progress" value={workingCount} hint={workingCount === 0 ? 'Nobody working' : 'Being fixed now'} />
          <StatTile icon={Check} label="Resolved" value={doneCount} hint={doneCount === 0 ? 'None closed yet' : 'Done or closed'} />
          <StatTile icon={MessageSquare} label="Total" value={tickets.length} hint="All time" />
        </StatTileGrid>
      )}

      {tickets.length > 0 && (
        <SearchField
          className="mb-6"
          value={search}
          onChange={setSearch}
          placeholder="Search tickets by title, category or status..."
          filters={
            <FilterPills
              value={statusFilter}
              onChange={setStatusFilter}
              onClear={search || statusFilter !== 'all' ? () => { setSearch(''); setStatusFilter('all'); } : undefined}
              options={[
                { key: 'all', label: 'All', count: tickets.length },
                { key: 'OPEN', label: 'Open', count: countOf(['OPEN']) },
                { key: 'ASSIGNED', label: 'Assigned', count: countOf(['ASSIGNED']) },
                { key: 'IN_PROGRESS', label: 'In progress', count: workingCount },
                { key: 'RESOLVED', label: 'Resolved', count: countOf(['RESOLVED']) },
                { key: 'CLOSED', label: 'Closed', count: countOf(['CLOSED']) },
              ]}
            />
          }
          hint={
            search || statusFilter !== 'all'
              ? `Showing ${filtered.length} of ${tickets.length} tickets`
              : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} · ${openCount + workingCount} still open`
          }
        />
      )}

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <PanelEmpty
            icon={Wrench}
            title="No tickets yet"
            description="Something broken, leaking or noisy? Raise a ticket and your committee will pick it up."
            action={
              <button
                onClick={openForm}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700"
              >
                <Plus className="h-4 w-4" /> Raise a ticket
              </button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <PanelEmpty
            icon={Wrench}
            title="Nothing matched that"
            description="No ticket matches your current search and filter."
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
        <ul className="space-y-3">
          {filtered.map((t) => {
            const meta = metaFor(t.status);
            return (
              <li key={t.id}>
                <button
                  onClick={() => viewTicket(t.id)}
                  className="group relative block w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-0 text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_10px_26px_-14px_rgba(37,99,235,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5 ${meta.rail}`} aria-hidden="true" />

                  <div className="px-5 py-4 pl-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium capitalize text-gray-600 ring-1 ring-gray-200/70">
                        {categoryLabel(t.category)}
                      </span>
                      {t.commentCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-caption-xs text-gray-400">
                          <MessageSquare className="h-3 w-3" /> {t.commentCount}
                        </span>
                      )}
                      <span className="ml-auto text-caption-xs text-gray-400">{shortDate(t.createdAt)}</span>
                    </div>

                    <div className="mt-3 flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-body font-semibold text-gray-900">{t.title}</h3>
                        <p className="mt-1 line-clamp-2 text-body-sm leading-relaxed text-gray-500">{t.description}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption-xs text-gray-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Home className="h-3.5 w-3.5 text-gray-400" /> Unit {t.unitNumber || 'not set'}
                          </span>
                          {t.assignedTo && (
                            <span className="inline-flex items-center gap-1.5">
                              <Wrench className="h-3.5 w-3.5 text-gray-400" /> {t.assignedTo}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 font-semibold text-accent-600">View details</span>
                        </div>
                      </div>

                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 transition-all duration-300 group-hover:bg-accent-600 group-hover:text-white">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Raise a ticket ──────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Raise a ticket"
        subtitle="Tell us what is wrong and we will get it to the right person"
        icon={Wrench}
        footer={
          <>
            <button
              type="submit"
              form="raise-ticket"
              disabled={submitting}
              className="flex-1 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {submitting ? 'Submitting...' : 'Submit ticket'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </button>
          </>
        }
      >
        <form id="raise-ticket" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className={fieldLabel} htmlFor="ticket-title">Title</label>
            <input
              id="ticket-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kitchen tap dripping"
              required
              maxLength={200}
              className={fieldInput}
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="ticket-category">Category</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="ticket-description">Description</label>
            <textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              maxLength={5000}
              placeholder="What is happening, since when, and anything the team should know before visiting."
              className={`${fieldInput} resize-y`}
            />
          </div>

          <div>
            <span className={fieldLabel}>Photos (optional)</span>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-body-sm text-gray-500 transition-all hover:border-accent-300 hover:bg-accent-50/40 hover:text-accent-700">
              <ImagePlus className="h-4 w-4" />
              <span>
                {uploadingPhotos
                  ? `Uploading photos… ${photoProgress}%`
                  : photos.length === 0
                    ? 'Add up to 5 photos'
                    : `${photos.length} photo${photos.length === 1 ? '' : 's'} selected`}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setPhotos((prev) => [...prev, ...files].slice(0, 5));
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewFor(f)} alt={f.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={`Remove ${f.name}`}
                      className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-gray-500 shadow-sm transition-colors hover:bg-white hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-body-sm text-red-700">{error}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
