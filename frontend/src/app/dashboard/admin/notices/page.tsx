'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, FileText, Send, Trash2, Eye, Clock, CheckCircle, Target,
  Building2, Megaphone, Wrench, CalendarDays, AlertTriangle, CreditCard, X,
  ChevronRight, User,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { ApiError, apiPost, apiGet, apiPatch, apiDelete } from '@/lib/api';
import type { NoticeResponse } from '@apartment/shared';

// Category drives the card accent, icon and pill, so the list reads at a glance.
const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; pill: string; bar: string; chip: string }> = {
  general: {
    label: 'General',
    icon: Megaphone,
    pill: 'bg-accent-50 text-accent-700 ring-accent-200/70',
    bar: 'bg-accent-500',
    chip: 'from-accent-500 to-accent-600 ring-accent-200',
  },
  maintenance: {
    label: 'Maintenance',
    icon: Wrench,
    pill: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    bar: 'bg-amber-500',
    chip: 'from-amber-500 to-amber-600 ring-amber-200',
  },
  event: {
    label: 'Event',
    icon: CalendarDays,
    pill: 'bg-purple-50 text-purple-700 ring-purple-200/70',
    bar: 'bg-purple-500',
    chip: 'from-purple-500 to-purple-600 ring-purple-200',
  },
  emergency: {
    label: 'Emergency',
    icon: AlertTriangle,
    pill: 'bg-red-50 text-red-700 ring-red-200/70',
    bar: 'bg-red-500',
    chip: 'from-red-500 to-red-600 ring-red-200',
  },
  billing: {
    label: 'Billing',
    icon: CreditCard,
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    bar: 'bg-emerald-500',
    chip: 'from-emerald-500 to-emerald-600 ring-emerald-200',
  },
};

const categoryMeta = (category: string) =>
  CATEGORY_META[category?.toLowerCase()] || CATEGORY_META.general;

const FILTERS = ['ALL', 'PUBLISHED', 'DRAFT'] as const;
type StatusFilter = (typeof FILTERS)[number];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (value: string) =>
  `${formatDate(value)} at ${new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

export default function AdminNoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [publish, setPublish] = useState(false);
  const [targetType, setTargetType] = useState<'ALL_UNITS' | 'SPECIFIC_UNITS'>('ALL_UNITS');
  const [targetUnitIds, setTargetUnitIds] = useState<string[]>([]);
  const [units, setUnits] = useState<Array<{ id: string; unitNumber: string; buildingName: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  // Reading happens in a dialog so the list never shifts when a notice opens.
  const [selected, setSelected] = useState<NoticeResponse | null>(null);

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
    // Load units for targeting
    apiGet<any[]>('/api/v1/units')
      .then((data) => {
        setUnits((data || []).map((u: any) => ({
          id: u.id,
          unitNumber: u.unitNumber,
          buildingName: u.building?.name || '',
        })));
      })
      .catch(() => {});
  }, [fetchNotices]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await apiPost<NoticeResponse>('/api/v1/notices', {
        title, content, category, publish,
        targetType,
        targetUnitIds: targetType === 'SPECIFIC_UNITS' ? targetUnitIds : undefined,
      });
      setTitle('');
      setContent('');
      setCategory('general');
      setPublish(false);
      setTargetType('ALL_UNITS');
      setTargetUnitIds([]);
      setShowForm(false);
      setSuccess(publish ? 'Notice published' : 'Draft saved');
      fetchNotices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, fromModal = false) => {
    if (!confirm('Delete this notice?')) return;
    try {
      await apiDelete(`/api/v1/notices/${id}`);
      setSuccess('Notice deleted');
      if (fromModal) setSelected(null);
      fetchNotices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handlePublish = async (id: string, fromModal = false) => {
    try {
      await apiPatch(`/api/v1/notices/${id}`, { publish: true });
      setSuccess('Notice published');
      if (fromModal) {
        const fresh = await apiGet<NoticeResponse>(`/api/v1/notices/${id}`).catch(() => null);
        setSelected(fresh || null);
      }
      fetchNotices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading notices...</p>
        </div>
      </div>
    );
  }

  const published = notices.filter((n) => n.publishedAt);
  const drafts = notices.filter((n) => !n.publishedAt);
  const totalReads = notices.reduce((sum, n) => sum + (n.readCount || 0), 0);

  const counts: Record<StatusFilter, number> = {
    ALL: notices.length,
    PUBLISHED: published.length,
    DRAFT: drafts.length,
  };

  const q = search.trim().toLowerCase();
  const visible = notices.filter((n) => {
    if (statusFilter === 'PUBLISHED' && !n.publishedAt) return false;
    if (statusFilter === 'DRAFT' && n.publishedAt) return false;
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.category || '').toLowerCase().includes(q) ||
      (n.authorName || '').toLowerCase().includes(q)
    );
  });

  const hasFilters = Boolean(q) || statusFilter !== 'ALL';
  const clearFilters = () => { setSearch(''); setStatusFilter('ALL'); };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="max-w-5xl mx-auto px-6 py-8">
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
            <h1 className="text-2xl font-display font-bold text-gray-900">Notices</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Announcements residents see in their app.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setError(''); }}
            className="flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> New notice
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
            <CheckCircle className="mt-0.5 w-4 h-4 flex-shrink-0 text-emerald-600" />
            <p className="flex-1 text-body-sm text-emerald-700">{success}</p>
            <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stats */}
        {notices.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { icon: FileText, label: 'Notices', value: notices.length, color: 'text-accent-600', bg: 'bg-accent-50' },
              { icon: CheckCircle, label: 'Published', value: published.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { icon: Clock, label: 'Drafts', value: drafts.length, color: 'text-amber-600', bg: 'bg-amber-50' },
              { icon: Eye, label: 'Total reads', value: totalReads, color: 'text-purple-600', bg: 'bg-purple-50' },
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

        {/* Search + filter */}
        {notices.length > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 lg:max-w-md">
                <FileText className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notices..."
                  aria-label="Search notices"
                  className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Show</span>
                {FILTERS.map((f) => {
                  const active = statusFilter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-body-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,1)]'
                          : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                      <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>
                        {counts[f]}
                      </span>
                    </button>
                  );
                })}
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-500 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {notices.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <Megaphone className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No notices yet</h3>
            <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
              Post your first announcement and it lands in every resident&apos;s app instantly.
            </p>
            <button
              onClick={() => { setShowForm(true); setError(''); }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <Plus className="w-4 h-4" /> New notice
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <FileText className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No notices match these filters</h3>
            <p className="mb-6 text-body-sm text-gray-500">
              {q ? `Nothing matched “${search.trim()}”. ` : ''}Try widening the status filter.
            </p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((notice) => {
              const meta = categoryMeta(notice.category);
              const CategoryIcon = meta.icon;
              const unitTargets = notice.targetUnitIds?.length || 0;
              return (
                <button
                  key={notice.id}
                  onClick={() => setSelected(notice)}
                  className="group relative block w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-4 py-5 pl-6 pr-5">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.chip} ring-1 transition-transform duration-300 group-hover:scale-110`}>
                      <CategoryIcon className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="truncate text-title-sm font-display text-gray-900 transition-colors duration-200 group-hover:text-accent-700">
                          {notice.title}
                        </h3>
                        <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.pill}`}>
                          {meta.label}
                        </span>
                        {notice.publishedAt ? (
                          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Published
                          </span>
                        ) : (
                          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Draft
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 line-clamp-2 text-body-sm text-gray-500">{notice.content}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <User className="w-3 h-3 text-gray-400" />
                          {notice.authorName}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <CalendarDays className="w-3 h-3 text-gray-400" />
                          {formatDate(notice.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <Eye className="w-3 h-3 text-gray-400" />
                          {notice.readCount ?? 0} reads
                        </span>
                        {notice.targetType === 'SPECIFIC_UNITS' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-caption-xs text-purple-700">
                            <Target className="w-3 h-3" />
                            {unitTargets} unit{unitTargets === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-caption-xs text-accent-700">
                            <Building2 className="w-3 h-3" />
                            All units
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

      {/* ── Notice detail ───────────────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        icon={selected ? categoryMeta(selected.category).icon : FileText}
        title={selected?.title || 'Notice'}
        subtitle={selected ? `${categoryMeta(selected.category).label} · by ${selected.authorName} · ${formatDate(selected.createdAt)}` : undefined}
        size="md"
      >
        {selected && (
          <div className="space-y-5">
            {/* Status row */}
            <div className="flex flex-wrap items-center gap-2">
              {selected.publishedAt ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                  <CheckCircle className="w-3 h-3" /> Published {formatDate(selected.publishedAt)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/70">
                  <Clock className="w-3 h-3" /> Draft, not visible to residents
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200/70">
                <Eye className="w-3 h-3" /> {selected.readCount ?? 0} reads
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                selected.targetType === 'SPECIFIC_UNITS'
                  ? 'bg-purple-50 text-purple-700 ring-purple-200/70'
                  : 'bg-accent-50 text-accent-700 ring-accent-200/70'
              }`}>
                {selected.targetType === 'SPECIFIC_UNITS' ? <Target className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                {selected.targetType === 'SPECIFIC_UNITS'
                  ? `${selected.targetUnitIds?.length || 0} unit${(selected.targetUnitIds?.length || 0) === 1 ? '' : 's'}`
                  : 'All units'}
              </span>
            </div>

            {/* Body */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="whitespace-pre-wrap text-body-sm leading-relaxed text-gray-700">{selected.content}</p>
            </div>

            {/* Meta */}
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 px-4">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-caption-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Author</span>
                <span className="text-body-sm font-medium text-gray-900">{selected.authorName}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-caption-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Created</span>
                <span className="text-body-sm font-medium text-gray-900">{formatDateTime(selected.createdAt)}</span>
              </div>
              {selected.publishedAt && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-caption-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Published</span>
                  <span className="text-body-sm font-medium text-gray-900">{formatDateTime(selected.publishedAt)}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-1">
              {!selected.publishedAt && (
                <button
                  onClick={() => handlePublish(selected.id, true)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-600 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
                >
                  <Send className="w-4 h-4" /> Publish now
                </button>
              )}
              <button
                onClick={() => handleDelete(selected.id, true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <button
                onClick={() => setSelected(null)}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create notice ───────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        icon={Megaphone}
        title="New notice"
        subtitle="Save it as a draft, or publish it straight to every resident."
        size="md"
      >
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className={fieldLabel} htmlFor="notice-title">Title</label>
            <input
              id="notice-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Water tank cleaning on Saturday"
              required
              maxLength={200}
              className={fieldInput}
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="notice-category">Category</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="general">General</option>
              <option value="maintenance">Maintenance</option>
              <option value="event">Event</option>
              <option value="emergency">Emergency</option>
              <option value="billing">Billing</option>
            </Select>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="notice-content">Content</label>
            <textarea
              id="notice-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the notice content..."
              required
              maxLength={10000}
              rows={6}
              className={`${fieldInput} resize-y`}
            />
          </div>

          {/* Targeting */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Audience</span>
              <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { value: 'ALL_UNITS' as const, label: 'All units', hint: 'Every resident', icon: Building2 },
                { value: 'SPECIFIC_UNITS' as const, label: 'Specific units', hint: 'Pick who sees it', icon: Target },
              ].map((opt) => {
                const active = targetType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setTargetType(opt.value); if (opt.value === 'ALL_UNITS') setTargetUnitIds([]); }}
                    aria-pressed={active}
                    className={`rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                      active
                        ? 'border-accent-300 bg-accent-50 ring-2 ring-accent-500/15'
                        : 'border-gray-200/80 bg-gray-50/70 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <opt.icon className={`w-4 h-4 ${active ? 'text-accent-600' : 'text-gray-400'}`} />
                    <p className={`mt-2 text-body-sm font-medium ${active ? 'text-accent-700' : 'text-gray-700'}`}>{opt.label}</p>
                    <p className="text-caption-xs text-gray-400">{opt.hint}</p>
                  </button>
                );
              })}
            </div>

            {targetType === 'SPECIFIC_UNITS' && (
              <div className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-3">
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {units.length === 0 ? (
                    <p className="text-caption-xs text-gray-400">No units available</p>
                  ) : (
                    units.map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={targetUnitIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTargetUnitIds([...targetUnitIds, u.id]);
                            } else {
                              setTargetUnitIds(targetUnitIds.filter((id) => id !== u.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-accent-600 focus:ring-2 focus:ring-accent-500/30"
                        />
                        <span className="text-body-sm text-gray-700">
                          Unit {u.unitNumber}{u.buildingName ? ` (${u.buildingName})` : ''}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {targetUnitIds.length > 0 && (
                  <p className="mt-2 border-t border-gray-200 pt-2 text-caption-xs text-gray-500">
                    {targetUnitIds.length} unit{targetUnitIds.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Publish toggle */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200/80 bg-gray-50/60 p-3.5">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-accent-600 focus:ring-2 focus:ring-accent-500/30"
            />
            <span>
              <span className="block text-body-sm font-medium text-gray-900">Publish immediately</span>
              <span className="mt-0.5 block text-caption-xs text-gray-400">
                Leave off to save as a draft you can publish later.
              </span>
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : publish ? <><Send className="w-4 h-4" /> Create &amp; publish</> : <><FileText className="w-4 h-4" /> Save draft</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
