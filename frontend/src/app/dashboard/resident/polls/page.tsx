'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, CheckCircle, Clock, Vote } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { PollResponse } from '@apartment/shared';

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
      setSuccess('Your vote has been recorded!');
      fetchPolls();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(null); }
  };

  const activePolls = polls.filter((p) => p.status === 'ACTIVE');
  const closedPolls = polls.filter((p) => p.status !== 'ACTIVE');

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/resident')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <div><h1 className="text-2xl font-bold text-gray-900">Voting</h1><p className="text-gray-700 text-sm">Cast your vote on community polls</p></div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* Active Polls */}
        <h2 className="text-lg font-semibold mb-4">Open Polls</h2>
        {activePolls.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 border border-gray-200 text-center mb-8">
            <BarChart3 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-700 text-sm">No open polls right now</p>
            <p className="text-gray-700 text-xs mt-1">Check back when a new poll is created</p>
          </div>
        ) : (
          <div className="space-y-5 mb-8">
            {activePolls.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 border border-amber-500/10">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">ACTIVE</span>
                      <span className="text-[10px] text-gray-700 flex items-center gap-1"><Clock className="w-3 h-3" /> Ends {new Date(p.endsAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-semibold mb-1">{p.title}</h3>
                    {p.description && <p className="text-xs text-gray-700">{p.description}</p>}
                  </div>
                  {p.hasVoted && (
                    <span className="text-[10px] flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                      <CheckCircle className="w-3 h-3" /> Voted
                    </span>
                  )}
                </div>

                {p.hasVoted && p.results ? (
                  // Show results if already voted and visible
                  <div className="space-y-2 mt-3">
                    {p.options.map((opt, i) => {
                      const r = p.results!.find((res) => res.optionIndex === i);
                      const count = r?.count || 0;
                      const total = p.totalVotes || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={i} className="text-xs">
                          <div className="flex justify-between text-gray-700 mb-0.5">
                            <span className={p.myVote === i ? 'text-amber-400 font-medium' : ''}>{opt.label} {p.myVote === i ? '(Your vote)' : ''}</span>
                            <span>{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-gray-50 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${p.myVote === i ? 'bg-amber-500' : 'bg-white/10'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-gray-700 mt-1">{p.totalVotes} total votes</p>
                  </div>
                ) : !p.hasVoted ? (
                  // Show voting options
                  <div className="mt-3 space-y-2">
                    {p.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedOption({ ...selectedOption, [p.id]: i })}
                        className={`w-full text-left text-sm px-4 py-3 rounded-lg border transition-all ${
                          selectedOption[p.id] === i
                            ? 'border-amber-500/50 bg-amber-500/10 text-white'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-amber-500/20 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedOption[p.id] === i ? 'border-amber-500' : 'border-gray-500'
                          }`}>
                            {selectedOption[p.id] === i && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                          </div>
                          <div>
                            <p className="font-medium">{opt.label}</p>
                            {opt.description && <p className="text-xs text-gray-700">{opt.description}</p>}
                          </div>
                        </div>
                      </button>
                    ))}

                    {selectedOption[p.id] !== undefined && (
                      <button
                        onClick={() => handleVote(p.id, selectedOption[p.id])}
                        disabled={submitting === p.id}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-all mt-2 flex items-center justify-center gap-2"
                      >
                        <Vote className="w-4 h-4" />
                        {submitting === p.id ? 'Casting Vote...' : 'Submit Vote'}
                      </button>
                    )}
                  </div>
                ) : null}

                {p.resultsVisibility === 'LIVE' && p.hasVoted && (
                  <p className="text-[10px] text-gray-700 mt-2">Results are visible live</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Past Polls */}
        {closedPolls.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-4">Past Polls</h2>
            <div className="space-y-3">
              {closedPolls.map((p) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        p.status === 'CLOSED' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-700'
                      }`}>{p.status}</span>
                      <span className="text-xs text-gray-700 font-medium">{p.title}</span>
                    </div>
                    {p.totalVotes !== undefined && (
                      <span className="text-[10px] text-gray-700">{p.totalVotes} votes</span>
                    )}
                  </div>

                  {/* Results for closed polls */}
                  {p.results && (
                    <div className="space-y-1.5 mt-2">
                      {p.options.map((opt, i) => {
                        const r = p.results!.find((res) => res.optionIndex === i);
                        const count = r?.count || 0;
                        const total = p.totalVotes || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={i} className="text-xs">
                            <div className="flex justify-between text-gray-700 mb-0.5">
                              <span>{opt.label}</span>
                              <span>{count} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-gray-50 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-white/10 h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
