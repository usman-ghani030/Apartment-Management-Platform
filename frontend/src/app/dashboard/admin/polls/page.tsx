'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, BarChart3, Play, Square, Clock, X, CheckCircle2,
  AlertTriangle, Trophy, CalendarDays, Users, Trash2, Eye,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { PollResponse } from '@apartment/shared';

const STATUS_META: Record<string, { pill: string; bar: string; chip: string; label: string }> = {
  DRAFT: {
    pill: 'bg-gray-100 text-gray-600 ring-gray-200/70',
    bar: 'bg-gray-300',
    chip: 'from-gray-400 to-gray-500 ring-gray-200',
    label: 'Draft',
  },
  ACTIVE: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    bar: 'bg-emerald-500',
    chip: 'from-emerald-500 to-emerald-600 ring-emerald-200',
    label: 'Voting open',
  },
  CLOSED: {
    pill: 'bg-accent-50 text-accent-700 ring-accent-200/70',
    bar: 'bg-accent-500',
    chip: 'from-accent-500 to-accent-600 ring-accent-200',
    label: 'Closed',
  },
};

const FALLBACK_STATUS = STATUS_META.DRAFT;
const statusMeta = (status: string) => STATUS_META[status] || FALLBACK_STATUS;

const FILTERS = ['ALL', 'ACTIVE', 'DRAFT', 'CLOSED'] as const;
type StatusFilter = (typeof FILTERS)[number];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (iso: string) =>
  `${formatDate(iso)} at ${new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in the browser's own timezone. */
const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultStart = () => toLocalInput(new Date());
const defaultEnd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalInput(d);
};

export default function AdminPollsPage() {
  const router = useRouter();
  const [polls, setPolls] = useState<PollResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [resultsVisibility, setResultsVisibility] = useState('AFTER_CLOSE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const fetchPolls = useCallback(async () => {
    try {
      const data = await apiGet<PollResponse[]>('/api/v1/polls');
      setPolls(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setOptions(['', '']);
    setStartsAt(defaultStart()); setEndsAt(defaultEnd());
    setResultsVisibility('AFTER_CLOSE');
    setShowForm(false); setError('');
  };

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const validOptions = options.filter((o) => o.trim()).map((o) => ({ label: o.trim() }));
      if (validOptions.length < 2) { setError('At least 2 options required'); setSubmitting(false); return; }
      if (!startsAt || !endsAt) { setError('Pick both a start and an end date'); setSubmitting(false); return; }
      if (new Date(endsAt) <= new Date(startsAt)) { setError('The end date must be after the start date'); setSubmitting(false); return; }

      await apiPost('/api/v1/polls', {
        title, description: description || undefined,
        options: validOptions,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        resultsVisibility,
      });
      resetForm();
      setSuccess('Poll created');
      fetchPolls();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const handleActivate = async (id: string) => {
    setError(''); setSuccess('');
    try {
      await apiPost(`/api/v1/polls/${id}/activate`);
      setSuccess('Poll opened for voting');
      fetchPolls();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleClose = async (id: string) => {
    setError(''); setSuccess('');
    try {
      await apiPost(`/api/v1/polls/${id}/close`);
      setSuccess('Poll closed');
      fetchPolls();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading polls...</p>
        </div>
      </div>
    );
  }

  const counts: Record<StatusFilter, number> = {
    ALL: polls.length,
    ACTIVE: polls.filter((p) => p.status === 'ACTIVE').length,
    DRAFT: polls.filter((p) => p.status === 'DRAFT').length,
    CLOSED: polls.filter((p) => p.status === 'CLOSED').length,
  };
  const visible = statusFilter === 'ALL' ? polls : polls.filter((p) => p.status === statusFilter);

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
            <h1 className="text-2xl font-display font-bold text-gray-900">Polls &amp; voting</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Put a decision to the community and watch the votes come in.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> New poll
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

        {/* Filter */}
        {polls.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
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
                  {f === 'ALL' ? 'All' : STATUS_META[f].label}
                  <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>
                    {counts[f]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Polls */}
        {polls.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <BarChart3 className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No polls yet</h3>
            <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
              Ask the community something. Every resident unit gets one vote unless you close it early.
            </p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <Plus className="w-4 h-4" /> New poll
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <BarChart3 className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No polls in this state</h3>
            <p className="text-body-sm text-gray-500">Try another filter to see the rest.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((p) => {
              const totalVotes = p.totalVotes || 0;
              const meta = statusMeta(p.status);
              const showBar = p.results && (p.resultsVisibility === 'LIVE' || p.status === 'CLOSED');
              const winnerIndex = p.results && totalVotes > 0
                ? p.results.reduce((best, r) => (r.count > (p.results!.find((x) => x.optionIndex === best)?.count || 0) ? r.optionIndex : best), 0)
                : -1;

              return (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} aria-hidden="true" />

                  <div className="p-5 pl-6">
                    {/* Header row */}
                    <div className="flex flex-wrap items-start gap-4">
                      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.chip} ring-1 transition-transform duration-300 group-hover:scale-105`}>
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-title-sm font-display text-gray-900">{p.title}</h3>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.pill}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500' : p.status === 'DRAFT' ? 'bg-gray-400' : 'bg-accent-500'}`} />
                            {meta.label}
                          </span>
                        </div>
                        {p.description && (
                          <p className="mt-1.5 max-w-2xl text-body leading-relaxed text-gray-700">{p.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                            <CalendarDays className="w-3 h-3 text-gray-400" />
                            {p.status === 'DRAFT' ? `Opens ${formatDate(p.startsAt)}` : formatDateTime(p.startsAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                            <Clock className="w-3 h-3 text-gray-400" />
                            Closes {formatDateTime(p.endsAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-caption-xs text-accent-700">
                            <Users className="w-3 h-3" />
                            {p.options.length} option{p.options.length === 1 ? '' : 's'}
                          </span>
                          {p.resultsVisibility === 'LIVE' && p.status === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-caption-xs text-emerald-700">
                              <Eye className="w-3 h-3" /> Results live
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0">
                        {p.status === 'DRAFT' && (
                          <button
                            onClick={() => handleActivate(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-body-sm font-medium text-white transition-all hover:bg-emerald-700"
                          >
                            <Play className="w-3.5 h-3.5" /> Open voting
                          </button>
                        )}
                        {p.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleClose(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-body-sm font-medium text-gray-600 transition-all hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
                          >
                            <Square className="w-3.5 h-3.5" /> Close poll
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Options + results */}
                    {p.status !== 'DRAFT' && (
                      <div className="mt-4 space-y-3.5 border-t border-gray-100 pt-4">
                        {p.options.map((opt, i) => {
                          const count = p.results?.find((r) => r.optionIndex === i)?.count || 0;
                          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                          const isWinner = showBar && i === winnerIndex && count > 0;
                          return (
                            <div key={i}>
                              <div className="mb-1.5 flex items-center justify-between gap-3">
                                <span className={`flex items-center gap-1.5 text-body ${isWinner ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                  {isWinner && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                                  {opt.label}
                                </span>
                                {showBar && (
                                  <span className="flex-shrink-0 text-caption-xs tabular-nums text-gray-500">
                                    {count} vote{count === 1 ? '' : 's'} &middot; {pct}%
                                  </span>
                                )}
                              </div>
                              {showBar && (
                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${isWinner ? 'bg-gradient-to-r from-accent-500 to-accent-400' : 'bg-accent-300'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <p className="text-caption-xs text-gray-400">
                          {totalVotes} total vote{totalVotes === 1 ? '' : 's'}
                          {p.resultsVisibility === 'NEVER' && p.status === 'ACTIVE' && ' - results are hidden until the poll closes'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Create poll ─────────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={resetForm}
        icon={BarChart3}
        title="New poll"
        subtitle="Give residents a clear question and two or more options."
        size="md"
      >
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className={fieldLabel} htmlFor="poll-title">Question</label>
            <input
              id="poll-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Should we install EV chargers in the basement?"
              required
              maxLength={200}
              className={fieldInput}
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="poll-description">Description</label>
            <textarea
              id="poll-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional context for voters"
              className={`${fieldInput} resize-y`}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                Options ({options.length}/10)
              </span>
              <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-50 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-100">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => { const next = [...options]; next[i] = e.target.value; setOptions(next); }}
                    placeholder={`Option ${i + 1}`}
                    required
                    maxLength={200}
                    className={fieldInput}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      aria-label={`Remove option ${i + 1}`}
                      className="flex-shrink-0 rounded-xl border border-gray-200 bg-white p-2 text-gray-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-body-sm font-medium text-accent-700 transition-all hover:bg-accent-100"
              >
                <Plus className="w-3.5 h-3.5" /> Add option
              </button>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Voting window</span>
              <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel} htmlFor="poll-start">Opens</label>
                <input
                  id="poll-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className={fieldInput}
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="poll-end">Closes</label>
                <input
                  id="poll-end"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                  className={fieldInput}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="poll-visibility">Results visibility</label>
            <Select value={resultsVisibility} onChange={(e) => setResultsVisibility(e.target.value)}>
              <option value="AFTER_CLOSE">After the poll closes</option>
              <option value="LIVE">Live, while voting</option>
              <option value="NEVER">Never shown</option>
            </Select>
            <p className="mt-2 text-caption-xs text-gray-400">
              Live results can influence voters, so &quot;after it closes&quot; is the safer default.
            </p>
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
              {submitting ? 'Creating...' : <><BarChart3 className="w-4 h-4" /> Create poll</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
