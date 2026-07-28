'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, BarChart3, Play, Square, Clock } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { PollResponse, PollOption } from '@apartment/shared';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-700',
  ACTIVE: 'bg-green-500/10 text-green-400',
  CLOSED: 'bg-blue-500/10 text-blue-400',
};

export default function AdminPollsPage() {
  const router = useRouter();
  const [polls, setPolls] = useState<PollResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [resultsVisibility, setResultsVisibility] = useState('AFTER_CLOSE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedPoll, setSelectedPoll] = useState<string | null>(null);

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
    setStartsAt(''); setEndsAt(''); setResultsVisibility('AFTER_CLOSE');
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

      await apiPost('/api/v1/polls', {
        title, description: description || undefined,
        options: validOptions,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        resultsVisibility,
      });
      resetForm();
      fetchPolls();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const handleActivate = async (id: string) => {
    try {
      await apiPost(`/api/v1/polls/${id}/activate`);
      fetchPolls();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleClose = async (id: string) => {
    try {
      await apiPost(`/api/v1/polls/${id}/close`);
      fetchPolls();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
            <div><h1 className="text-2xl font-bold text-gray-900">Polls & Voting</h1><p className="text-gray-700 text-sm">Create and manage community polls</p></div>
          </div>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Plus className="w-4 h-4" /> New Poll</button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        {/* Create Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold mb-4">Create New Poll</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question / Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Should we renovate the clubhouse?" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Additional context for voters" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 resize-y" />
              </div>

              {/* Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options ({options.length}/10)</label>
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={opt} onChange={(e) => { const next = [...options]; next[i] = e.target.value; setOptions(next); }} placeholder={`Option ${i + 1}`} required className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="text-xs text-red-400 hover:text-red-300 px-2">×</button>
                    )}
                  </div>
                ))}
                {options.length < 10 && (
                  <button type="button" onClick={addOption} className="text-xs text-accent-600 hover:text-accent-700 mt-1">+ Add option</button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date/Time</label>
                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50 [color-scheme:light]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date/Time</label>
                  <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50 [color-scheme:light]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Results Visibility</label>
                  <select value={resultsVisibility} onChange={(e) => setResultsVisibility(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50">
                    <option value="AFTER_CLOSE">After poll closes</option>
                    <option value="LIVE">Live (visible during voting)</option>
                    <option value="NEVER">Never shown</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition-all">{submitting ? 'Creating...' : 'Create Poll'}</button>
                <button type="button" onClick={resetForm} className="text-sm text-gray-700 hover:text-gray-900 px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Polls List */}
        {polls.length === 0 ? (
          <div className="text-center py-20"><BarChart3 className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No polls yet</p><p className="text-gray-700 text-sm mt-1">Create your first poll to get started</p></div>
        ) : (
          <div className="space-y-4">
            {polls.map((p) => {
              const totalVotes = p.totalVotes || 0;
              const maxCount = p.results ? Math.max(...p.results.map((r) => r.count), 1) : 1;

              return (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] || ''}`}>{p.status}</span>
                        <span className="text-xs text-gray-700 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(p.endsAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-medium text-sm">{p.title}</h3>
                      {p.description && <p className="text-xs text-gray-700 mt-0.5">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      {p.status === 'DRAFT' && (
                        <button onClick={() => handleActivate(p.id)} className="p-1.5 hover:bg-green-500/10 rounded-lg transition-colors text-green-400" title="Activate"><Play className="w-4 h-4" /></button>
                      )}
                      {p.status === 'ACTIVE' && (
                        <button onClick={() => handleClose(p.id)} className="p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors text-blue-400" title="Close"><Square className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>

                  {/* Vote counts / Results */}
                  {p.status !== 'DRAFT' && (
                    <div className="space-y-1.5 mt-3">
                      {p.options.map((opt, i) => {
                        const result = p.results?.find((r) => r.optionIndex === i);
                        const count = result?.count || 0;
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const showBar = p.results && (p.resultsVisibility === 'LIVE' || p.status === 'CLOSED');

                        return (
                          <div key={i} className="text-xs">
                            <div className="flex justify-between text-gray-700 mb-0.5">
                              <span>{opt.label}</span>
                              {showBar && <span>{count} vote{count !== 1 ? 's' : ''} ({pct}%)</span>}
                            </div>
                            {showBar && (
                              <div className="w-full bg-gray-50 rounded-full h-2 overflow-hidden">
                                <div className="bg-accent-500/60 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-[10px] text-gray-700 mt-1">{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</p>
                    </div>
                  )}

                  {p.status === 'DRAFT' && (
                    <p className="text-xs text-gray-700 mt-2">Starts {new Date(p.startsAt).toLocaleString()}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
