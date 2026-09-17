'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, Eye, CheckCircle2, Clock, ChevronRight, Search,
  X, Bell, CalendarDays, User, Inbox,
} from 'lucide-react';
import { ApiError, apiGet } from '@/lib/api';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { StatTile, StatTileGrid } from '@/components/ui/StatTile';
import { SearchField, FilterPills } from '@/components/ui/SearchField';
import type { NoticeResponse } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Resident notices. Fetched once and filtered in the browser, so typing and
// category switching are instant and the tiles never jump around. Opening a
// notice hits /notices/:id, which is what records the read receipt.
// ─────────────────────────────────────────────────────────────────────────────

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/** Category drives only the label; the chip stays on the page's blue accent. */
const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  maintenance: 'Maintenance',
  security: 'Security',
  event: 'Event',
  billing: 'Billing',
  emergency: 'Emergency',
};

const categoryLabel = (c: string) =>
  CATEGORY_LABELS[c?.toLowerCase()] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'General');

export default function ResidentNoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NoticeResponse | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const fetchNotices = useCallback(async () => {
    try {
      const data = await apiGet<NoticeResponse[]>('/api/v1/notices');
      setNotices(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const viewNotice = async (notice: NoticeResponse) => {
    setOpeningId(notice.id);
    try {
      // Fetch the full notice: this is the call that records the read receipt.
      const full = await apiGet<NoticeResponse>(`/api/v1/notices/${notice.id}`);
      setSelected(full);
      setNotices((prev) => prev.map((n) => (n.id === full.id ? { ...n, hasRead: true, readCount: full.readCount } : n)));
    } catch {
      setSelected(notice);
    } finally {
      setOpeningId(null);
    }
  };

  const unread = notices.filter((n) => !n.hasRead).length;
  const lastWeek = useMemo(
    () => notices.filter((n) => Date.now() - new Date(n.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000).length,
    [notices]
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    notices.forEach((n) => {
      const key = (n.category || 'general').toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [notices]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      notices.filter((n) => {
        if (category !== 'all' && (n.category || 'general').toLowerCase() !== category) return false;
        if (!q) return true;
        return [n.title, n.content, n.category, n.authorName || ''].some((v) => (v || '').toLowerCase().includes(q));
      }),
    [notices, category, q]
  );

  const filtersActive = q.length > 0 || category !== 'all';
  const clearFilters = () => { setSearch(''); setCategory('all'); };

  if (loading) return <PageSkeleton width="max-w-5xl" />;

  // ── Detail view ──────────────────────────────────────────────────────
  if (selected) {
    const others = notices.filter((n) => n.id !== selected.id).slice(0, 3);
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <button
          onClick={() => setSelected(null)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to notices
        </button>

        <article className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" aria-hidden="true" />

          <header className="border-b border-gray-100 bg-gray-50/60 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700 ring-1 ring-accent-200/70">
                {categoryLabel(selected.category)}
              </span>
              {selected.hasRead ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-caption-xs font-medium text-gray-500 ring-1 ring-gray-200/80">
                  <CheckCircle2 className="h-3 w-3 text-accent-500" /> Read
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-caption-xs font-medium text-gray-700 ring-1 ring-gray-200/80">
                  <Clock className="h-3 w-3 text-accent-500" /> New
                </span>
              )}
              {selected.targetType === 'SPECIFIC_UNITS' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-caption-xs font-medium text-gray-600 ring-1 ring-gray-200/80">
                  Sent to your unit
                </span>
              )}
            </div>

            <h1 className="mt-3.5 text-display-sm font-display leading-snug text-gray-900">{selected.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-caption-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-gray-400" />
                {selected.authorName || 'Committee'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                {longDate(selected.createdAt)}
              </span>
              {selected.readCount !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-gray-400" />
                  {selected.readCount} {selected.readCount === 1 ? 'read' : 'reads'}
                </span>
              )}
            </div>
          </header>

          <div className="whitespace-pre-wrap px-6 py-6 text-body leading-relaxed text-gray-700">
            {selected.content}
          </div>
        </article>

        {others.length > 0 && (
          <section className="mt-8">
            <div className="mb-3.5 flex items-center gap-3">
              <span className="h-4 w-1 rounded-full bg-accent-400" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">More notices</p>
              <span className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              {others.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setSelected(null); viewNotice(n); }}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-gray-200/80 bg-white px-5 py-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_10px_26px_-14px_rgba(37,99,235,0.28)]"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                    <FileText className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold text-gray-900">{n.title}</span>
                    <span className="mt-0.5 block truncate text-caption-xs text-gray-500">
                      {categoryLabel(n.category)}
                      <span className="mx-1.5 text-gray-300">&middot;</span>
                      {shortDate(n.createdAt)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-500" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/resident')}
          aria-label="Back to dashboard"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-display-sm font-display text-gray-900">Notices</h1>
            <p className="text-body-sm text-gray-500">Everything your committee has announced</p>
          </div>
        </div>
      </div>

      {/* Tiles */}
      {notices.length > 0 && (
        <StatTileGrid columns={3} className="mb-6">
          <StatTile icon={Inbox} label="Notices" value={notices.length} hint="Posted to your society" />
          <StatTile icon={Bell} label="Unread" value={unread} hint={unread === 0 ? 'All caught up' : 'Waiting to be opened'} />
          <StatTile icon={CalendarDays} label="Last 7 days" value={lastWeek} hint="Recent announcements" />
        </StatTileGrid>
      )}

      {/* Search + filters */}
      <SearchField
        className="mb-6"
        value={search}
        onChange={setSearch}
        placeholder="Search notices by title, content or author..."
        filters={
          categories.length > 0 ? (
            <FilterPills
              value={category}
              onChange={setCategory}
              onClear={filtersActive ? clearFilters : undefined}
              options={[
                { key: 'all', label: 'All', count: notices.length },
                ...categories.map(([key, count]) => ({ key, label: categoryLabel(key), count })),
              ]}
            />
          ) : undefined
        }
        hint={
          filtersActive
            ? `Showing ${filtered.length} of ${notices.length} notices${category !== 'all' ? ` in ${categoryLabel(category)}` : ''}`
            : `${notices.length} notice${notices.length === 1 ? '' : 's'} · ${unread} unread`
        }
      />

      {/* List */}
      {notices.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
            <FileText className="h-6 w-6 text-accent-500" />
          </div>
          <h3 className="mb-2 text-title font-display text-gray-900">No notices yet</h3>
          <p className="mx-auto max-w-sm text-body-sm text-gray-500">
            Your committee has not posted anything. Announcements will land here, and unread ones are flagged.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
            <Search className="h-6 w-6 text-accent-500" />
          </div>
          <h3 className="mb-2 text-title font-display text-gray-900">Nothing matched that</h3>
          <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
            No notice matches your current search and filter.
          </p>
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
          >
            <X className="h-4 w-4" /> Clear filters
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((notice) => {
            const isNew = !notice.hasRead;
            const isOpening = openingId === notice.id;
            return (
              <li key={notice.id}>
                <button
                  onClick={() => viewNotice(notice)}
                  disabled={isOpening}
                  className="group relative block w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_10px_26px_-14px_rgba(37,99,235,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-70"
                >
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5 ${
                      isNew ? 'bg-accent-500' : 'bg-gray-200'
                    }`}
                    aria-hidden="true"
                  />

                  <div className="px-5 py-4 pl-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700 ring-1 ring-accent-200/70">
                        {categoryLabel(notice.category)}
                      </span>
                      {isNew ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
                          New
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-caption-xs font-medium text-gray-500 ring-1 ring-gray-200/70">
                          <CheckCircle2 className="h-3 w-3 text-gray-400" /> Read
                        </span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1.5 text-caption-xs text-gray-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {shortDate(notice.createdAt)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className={`truncate text-body font-semibold ${isNew ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notice.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-body-sm leading-relaxed text-gray-500">{notice.content}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption-xs text-gray-500">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-gray-400" />
                            {notice.authorName || 'Committee'}
                          </span>
                          {notice.readCount !== undefined && (
                            <span className="inline-flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5 text-gray-400" />
                              {notice.readCount} {notice.readCount === 1 ? 'read' : 'reads'}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 font-semibold text-accent-600">
                            {isOpening ? 'Opening...' : 'Read notice'}
                          </span>
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
    </div>
  );
}
