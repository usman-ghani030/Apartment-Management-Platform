'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, BarChart3, CheckCircle2, Clock, Vote, AlertCircle,
  X, Eye, CalendarDays,
} from 'lucide-react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import type { PollResponse } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Voting - residents cast one vote per unit on each open poll.
// Option rows are plain radio cards on the app's blue accent, so the selected
// choice and the result bars stay legible on the light dashboard.
// ─────────────────────────────────────────────────────────────────────────────

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

const pctOf = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

/** "Closes in 3 days" reads better than a raw date when the poll is still open. */
function closesIn(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return 'Closed';
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  return `Closes in ${days} days`;
}

export default function ResidentPollsPage() {
  const router = useRouter();
  const [polls, setPolls] = useState<PollResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPolls = useCallback(async () => {
    try {
      const data = await apiGet<PollResponse[]>('/api/v1/polls');
      setPolls(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const handleVote = async (pollId: string, optionIndex: number) => {
    setSubmitting(pollId); setError(''); setSuccess('');
    try {
      await apiPost(`/api/v1/polls/${pollId}/vote`, { optionIndex });
      setSuccess('Your vote has been recorded.');
      fetchPolls();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(null); }
  };

  const activePolls = polls.filter((p) => p.status === 'ACTIVE');
  const closedPolls = polls.filter((p) => p.status !== 'ACTIVE');

  if (loading) return <PageSkeleton width="max-w-5xl" />;

  return (
    <div className="min-h-screen text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/resident')}
            aria-label="Back to dashboard"
            className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
              <Vote className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-display-sm font-display text-gray-900">Voting</h1>
              <p className="text-body-sm text-gray-500">Decisions your committee has put to residents</p>
            </div>
          </div>
        </div>

        {/* Banners */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="flex-1 text-body-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <p className="flex-1 text-body-sm text-emerald-700">{success}</p>
            <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Open polls */}
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-title-sm font-display text-gray-900">Open polls</h2>
          <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
          <span className="rounded-full bg-white px-2.5 py-0.5 text-caption-xs font-medium text-gray-500 ring-1 ring-gray-200/80">
            {activePolls.length} open
          </span>
        </div>

        {activePolls.length === 0 ? (
          <div className="mb-8 rounded-2xl border border-gray-200/80 bg-white p-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
              <BarChart3 className="h-6 w-6 text-accent-500" />
            </div>
            <h3 className="mb-1.5 text-title-sm font-display text-gray-900">No open polls right now</h3>
            <p className="mx-auto max-w-sm text-body-sm text-gray-500">
              Your committee will publish one here when there is something to decide.
            </p>
          </div>
        ) : (
          <div className="mb-8 space-y-4">
            {activePolls.map((p) => {
              const totalVotes = p.totalVotes || 0;
              const canSeeResults = p.resultsVisibility === 'LIVE' && p.hasVoted && !!p.results;
              const picked = selectedOption[p.id];
              const winnerIndex = p.results && totalVotes > 0
                ? p.results.reduce((best, r) => (r.count > (p.results!.find((x) => x.optionIndex === best)?.count || 0) ? r.optionIndex : best), 0)
                : -1;

              return (
                <div
                  key={p.id}
                  className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent-500" aria-hidden="true" />
                  <div className="px-6 py-5 pl-7">
                      {/* Title row */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700 ring-1 ring-accent-200/70">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                              Open for voting
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                              <Clock className="h-3 w-3 text-gray-400" />
                              {closesIn(p.endsAt)} &middot; {formatDateTime(p.endsAt)}
                            </span>
                            {p.resultsVisibility === 'LIVE' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-caption-xs text-accent-700">
                                <Eye className="h-3 w-3" />
                                Live results
                              </span>
                            )}
                          </div>
                          <h3 className="text-title-sm font-display text-gray-900">{p.title}</h3>
                          {p.description && (
                            <p className="mt-1.5 max-w-2xl text-body leading-relaxed text-gray-700">{p.description}</p>
                          )}
                        </div>
                        {p.hasVoted && (
                          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1.5 text-caption-xs font-semibold text-accent-700 ring-1 ring-accent-200/70">
                            <CheckCircle2 className="h-3.5 w-3.5" /> You voted
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      {p.hasVoted ? (
                        canSeeResults ? (
                          <div className="mt-5 space-y-4.5 border-t border-gray-100 pt-5">
                            {p.options.map((opt, i) => {
                              const count = p.results!.find((r) => r.optionIndex === i)?.count || 0;
                              const pct = pctOf(count, totalVotes);
                              const isMine = p.myVote === i;
                              const isWinner = i === winnerIndex && count > 0;
                              return (
                                <div key={i}>
                                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-body-sm text-gray-700">
                                      <span className={isWinner ? 'font-semibold text-gray-900' : ''}>{opt.label}</span>
                                      {isWinner && (
                                        <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-700 ring-1 ring-accent-200/70">
                                          Leading
                                        </span>
                                      )}
                                      {isMine && (
                                        <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-700 ring-1 ring-accent-200/70">
                                          Your vote
                                        </span>
                                      )}
                                    </span>
                                    <span className="flex-shrink-0 text-caption-xs tabular-nums text-gray-500">
                                      {count} vote{count === 1 ? '' : 's'} &middot; {pct}%
                                    </span>
                                  </div>
                                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                                    <div
                                      className={`h-full rounded-full transition-all duration-700 ${
                                        isMine
                                          ? 'bg-gradient-to-r from-accent-600 to-accent-400'
                                          : isWinner
                                            ? 'bg-accent-400'
                                            : 'bg-gray-300'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            <p className="pt-1 text-caption-xs text-gray-400">
                              {totalVotes} total vote{totalVotes === 1 ? '' : 's'} so far
                            </p>
                          </div>
                        ) : (
                          <div className="mt-5 flex items-start gap-3 rounded-xl border border-gray-200/80 bg-gray-50/70 px-4 py-3.5">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-600" />
                            <div>
                              <p className="text-body-sm font-medium text-gray-700">Your vote is in</p>
                              <p className="mt-0.5 text-caption-xs text-gray-500">
                                {p.resultsVisibility === 'AFTER_CLOSE'
                                  ? 'Results are shown once the poll closes.'
                                  : 'Results are not being shared for this poll.'}
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="mt-5 border-t border-gray-100 pt-5">
                          <p className="mb-3 text-caption-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                            Choose one option
                          </p>
                          <div className="space-y-2.5">
                            {p.options.map((opt, i) => {
                              const isPicked = picked === i;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setSelectedOption({ ...selectedOption, [p.id]: i })}
                                  aria-pressed={isPicked}
                                  className={`flex w-full items-start gap-3.5 rounded-xl border px-4 py-4.5 text-left transition-all duration-200 ${
                                    isPicked
                                      ? 'border-accent-400 bg-accent-50 ring-4 ring-accent-500/10'
                                      : 'border-gray-200/80 bg-white hover:-translate-y-0.5 hover:border-accent-200 hover:bg-accent-50/40 hover:shadow-[0_8px_24px_-14px_rgba(37,99,235,0.5)]'
                                  }`}
                                >
                                  <span
                                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                      isPicked ? 'border-accent-600 bg-accent-600' : 'border-gray-300 bg-white'
                                    }`}
                                  >
                                    {isPicked && <span className="h-2 w-2 rounded-full bg-white" />}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className={`block text-body font-medium ${isPicked ? 'text-accent-800' : 'text-gray-800'}`}>
                                      {opt.label}
                                    </span>
                                    {opt.description && (
                                      <span className="mt-1 block text-caption leading-relaxed text-gray-500">
                                        {opt.description}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => picked !== undefined && handleVote(p.id, picked)}
                            disabled={picked === undefined || submitting === p.id}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-3 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                          >
                            <Vote className="h-4 w-4" />
                            {submitting === p.id
                              ? 'Casting your vote...'
                              : picked === undefined
                                ? 'Pick an option to vote'
                                : 'Submit vote'}
                          </button>
                          <p className="mt-2 text-center text-caption-xs text-gray-400">
                            You can vote once. This cannot be changed later.
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Closed polls */}
        {closedPolls.length > 0 && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-title-sm font-display text-gray-900">Past polls</h2>
              <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
              <span className="rounded-full bg-white px-2.5 py-0.5 text-caption-xs font-medium text-gray-500 ring-1 ring-gray-200/80">
                {closedPolls.length} closed
              </span>
            </div>

            <div className="space-y-3">
              {closedPolls.map((p) => {
                const totalVotes = p.totalVotes || 0;
                const winnerIndex = p.results && totalVotes > 0
                  ? p.results.reduce((best, r) => (r.count > (p.results!.find((x) => x.optionIndex === best)?.count || 0) ? r.optionIndex : best), 0)
                  : -1;
                return (
                  <div
                    key={p.id}
                    className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                  >
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300" aria-hidden="true" />
                    <div className="px-6 py-5 pl-7">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200/70">
                              {p.status === 'CLOSED' ? 'Closed' : p.status === 'DRAFT' ? 'Draft' : p.status}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                              <CalendarDays className="h-3 w-3 text-gray-400" />
                              Closed {formatDateTime(p.endsAt)}
                            </span>
                            {p.myVote != null && p.myVote >= 0 && (
                              <span className="rounded-md bg-accent-50 px-2 py-0.5 text-caption-xs text-accent-700">
                                You voted
                              </span>
                            )}
                          </div>
                          <h3 className="text-title-sm font-display text-gray-900">{p.title}</h3>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-gray-50 px-2.5 py-0.5 text-caption-xs font-medium tabular-nums text-gray-500 ring-1 ring-gray-200/70">
                          {totalVotes} vote{totalVotes === 1 ? '' : 's'}
                        </span>
                      </div>

                      {p.results && p.results.length > 0 && (
                        <div className="mt-4 space-y-2.5 border-t border-gray-100 pt-4">
                          {p.options.map((opt, i) => {
                            const count = p.results!.find((r) => r.optionIndex === i)?.count || 0;
                            const pct = pctOf(count, totalVotes);
                            const isMine = p.myVote === i;
                            const isWinner = i === winnerIndex && count > 0;
                            return (
                              <div key={i}>
                                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-caption-xs">
                                  <span className="flex items-center gap-1.5 text-gray-600">
                                    <span className={isWinner ? 'font-semibold text-gray-900' : ''}>{opt.label}</span>
                                    {isWinner && (
                                      <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-700 ring-1 ring-accent-200/70">
                                        Won
                                      </span>
                                    )}
                                    {isMine && <span className="text-accent-600">(your vote)</span>}
                                  </span>
                                  <span className="tabular-nums text-gray-400">{count} &middot; {pct}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className={`h-full rounded-full ${isWinner ? 'bg-accent-500' : 'bg-gray-300'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
