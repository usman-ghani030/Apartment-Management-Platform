'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wrench, ChevronRight, Send, UserPlus } from 'lucide-react';
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api';
import type { TicketResponse } from '@apartment/shared';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-yellow-500/10 text-yellow-400',
  ASSIGNED: 'bg-blue-500/10 text-blue-400',
  IN_PROGRESS: 'bg-purple-500/10 text-purple-400',
  RESOLVED: 'bg-green-500/10 text-green-400',
  CLOSED: 'bg-gray-500/10 text-gray-700',
};

const NEXT_STATUS: Record<string, string[]> = {
  OPEN: ['ASSIGNED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export default function AdminTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<TicketResponse | null>(null);
  const [comment, setComment] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [error, setError] = useState('');

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
      setAssignTo('');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await apiPatch(`/api/v1/tickets/${id}`, { status });
      setError('');
      if (selected && selected.id === id) viewTicket(id);
      else fetchTickets();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleAssign = async (id: string) => {
    if (!assignTo.trim()) return;
    try {
      await apiPatch(`/api/v1/tickets/${id}`, { assignedTo: assignTo, status: 'ASSIGNED' });
      setAssignTo('');
      viewTicket(id);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
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
    return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;
  }

  if (selected) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <main className="max-w-3xl mx-auto px-6 py-8">
          <button onClick={() => { setSelected(null); fetchTickets(); }} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_COLORS[selected.status] || ''}`}>{selected.status.replace('_', ' ')}</span>
                <span className="text-xs text-gray-700 capitalize">{selected.category}</span>
              </div>
              {/* Status transition buttons */}
              {NEXT_STATUS[selected.status]?.length > 0 && (
                <div className="flex gap-1">
                  {NEXT_STATUS[selected.status].map((s) => (
                    <button key={s} onClick={() => changeStatus(selected.id, s)}
                      className="text-xs bg-gray-50 hover:bg-gray-50 rounded-lg px-2.5 py-1 transition-colors">
                      {s === 'RESOLVED' ? '✓ Resolve' : s === 'CLOSED' ? '✕ Close' : s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold mb-1">{selected.title}</h1>
            <div className="text-xs text-gray-700 mb-3">{selected.residentName} · Unit {selected.unitNumber || 'N/A'} · {new Date(selected.createdAt).toLocaleDateString()}</div>
            {selected.assignedTo ? (
              <div className="text-xs bg-blue-500/10 text-blue-400 rounded-lg px-3 py-1.5 mb-3 inline-block">Assigned: {selected.assignedTo}</div>
            ) : (
              <div className="flex gap-2 mb-3">
                <input value={assignTo} onChange={(e) => setAssignTo(e.target.value)} placeholder="Assign to vendor..." className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                <button onClick={() => handleAssign(selected.id)} className="flex items-center gap-1 text-xs bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-3 py-1.5 transition-colors"><UserPlus className="w-3 h-3" /> Assign</button>
              </div>
            )}
            {error && <div className="text-xs text-red-400 mb-2">{error}</div>}
            <p className="text-sm text-gray-700 whitespace-pre-wrap mb-6">{selected.description}</p>

            {/* Photos */}
            {selected.photosUrl && (() => {
              try {
                const urls = JSON.parse(selected.photosUrl);
                if (Array.isArray(urls) && urls.length > 0) {
                  return (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold mb-2">Photos</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {urls.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="block aspect-video rounded-lg overflow-hidden bg-gray-50 hover:opacity-90 transition-opacity">
                            <img src={url} alt={`Ticket photo ${i + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch {}
              return null;
            })()}

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold mb-3">Timeline ({selected.comments?.length || 0})</h3>
              <div className="space-y-3 mb-4">
                {(selected.comments || []).map((c) => (
                  <div key={c.id} className="bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                      <span className="font-medium text-gray-700">{c.authorName}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700">{c.content}</p>
                  </div>
                ))}
                {(!selected.comments || selected.comments.length === 0) && <p className="text-xs text-gray-700">No comments yet</p>}
              </div>
              <form onSubmit={addComment} className="flex gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add an update..." className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                <button type="submit" className="bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Send className="w-4 h-4" /></button>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
            <div><h1 className="text-2xl font-bold text-gray-900">Maintenance</h1><p className="text-gray-700 text-sm">All society tickets</p></div>
          </div>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
            {['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`text-xs px-3 py-1.5 rounded-md transition-all ${filter === s ? 'bg-accent-600 text-white' : 'text-gray-700 hover:text-gray-900'}`}>
                {s === 'ALL' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="text-center py-20"><Wrench className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No tickets found</p></div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <button key={t.id} onClick={() => viewTicket(t.id)} className="w-full text-left bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200 hover:border-indigo-500/20 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] || ''}`}>{t.status.replace('_', ' ')}</span>
                      <span className="text-[10px] text-gray-700 capitalize">{t.category}</span>
                      {t.commentCount > 0 && <span className="text-[10px] text-gray-700">{t.commentCount} comments</span>}
                    </div>
                    <h3 className="font-medium text-sm truncate">{t.title}</h3>
                    <p className="text-xs text-gray-700 mt-0.5">{t.residentName} · Unit {t.unitNumber || 'N/A'}{t.assignedTo ? ` · → ${t.assignedTo}` : ''}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-700 mt-1 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
