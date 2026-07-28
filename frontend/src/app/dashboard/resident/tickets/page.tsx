'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, ChevronRight, Wrench, Image as ImageIcon, X } from 'lucide-react';
import { ApiError, apiGet, apiPost, apiUpload } from '@/lib/api';
import type { TicketResponse } from '@apartment/shared';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-yellow-500/10 text-yellow-400',
  ASSIGNED: 'bg-blue-500/10 text-blue-400',
  IN_PROGRESS: 'bg-status-info/10 text-status-info',
  RESOLVED: 'bg-green-500/10 text-green-400',
  CLOSED: 'bg-gray-500/10 text-gray-700',
};

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
  const [photos, setPhotos] = useState<File[]>([]);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await apiGet<TicketResponse[]>('/api/v1/tickets');
      setTickets(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const ticket = await apiPost<TicketResponse>('/api/v1/tickets', { title, description, category });
      
      // Upload photos if any
      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach((f) => formData.append('photos', f));
        await apiUpload(`/api/v1/tickets/${ticket.id}/photos`, formData);
      }

      setTitle(''); setDescription(''); setCategory('other');
      setPhotos([]);
      setShowForm(false);
      fetchTickets();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const viewTicket = async (id: string) => {
    try {
      const data = await apiGet<TicketResponse>(`/api/v1/tickets/${id}`);
      setSelected(data);
    } catch { }
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

  // Detail view
  if (selected) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <main className="max-w-3xl mx-auto px-6 py-8">
          <button onClick={() => { setSelected(null); fetchTickets(); }} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to tickets
          </button>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_COLORS[selected.status] || ''}`}>{selected.status.replace('_', ' ')}</span>
              <span className="text-xs text-gray-700 capitalize bg-gray-50 rounded-full px-2.5 py-0.5">{selected.category}</span>
            </div>
            <h1 className="text-xl font-bold mb-2">{selected.title}</h1>
            <div className="text-xs text-gray-700 mb-4">{selected.residentName} · {selected.unitNumber || 'No unit'} · {new Date(selected.createdAt).toLocaleDateString()}</div>
            {selected.assignedTo && <div className="text-xs text-blue-400 mb-4">Assigned to: {selected.assignedTo}</div>}
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

            {/* Comments */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold mb-3">Timeline ({selected.comments?.length || 0})</h3>
              <div className="space-y-3 mb-4">
                {(selected.comments || []).map((c) => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                      <span className="font-medium text-gray-700">{c.authorName}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700">{c.content}</p>
                  </div>
                ))}
                {(!selected.comments || selected.comments.length === 0) && (
                  <p className="text-xs text-gray-700">No comments yet</p>
                )}
              </div>
              <form onSubmit={addComment} className="flex gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                <button type="submit" className="bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all">Send</button>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/resident')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
            <div><h1 className="text-2xl font-bold text-gray-900">My Tickets</h1><p className="text-gray-700 text-sm">Maintenance requests</p></div>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Plus className="w-4 h-4" /> New Ticket</button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold mb-4">Raise a Ticket</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the issue?" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50">
                  <option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="hvac">HVAC / AC</option><option value="cleaning">Cleaning</option><option value="pest">Pest Control</option><option value="security">Security</option><option value="other">Other</option>
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail..." required rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all resize-y" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Photos (optional)</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 hover:border-accent-500/30 transition-all">
                    <ImageIcon className="w-4 h-4" />
                    <span>Add Photos</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setPhotos((prev) => [...prev, ...files].slice(0, 5));
                    }} className="hidden" />
                  </label>
                  {photos.length > 0 && (
                    <span className="text-xs text-gray-700">{photos.length} selected</span>
                  )}
                </div>
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photos.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 text-xs text-gray-700">
                        <ImageIcon className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} className="hover:text-red-400 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={submitting} className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all">{submitting ? 'Submitting...' : 'Submit Ticket'}</button>
            </form>
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="text-center py-20"><Wrench className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No tickets yet</p><p className="text-gray-700 text-sm mt-1">Raise a maintenance request to get help</p></div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <button key={t.id} onClick={() => viewTicket(t.id)} className="w-full text-left bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200 hover:border-accent-500/30 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] || ''}`}>{t.status.replace('_', ' ')}</span>
                      <span className="text-[10px] text-gray-700 capitalize">{t.category}</span>
                      {t.commentCount > 0 && <span className="text-[10px] text-gray-700">{t.commentCount} comments</span>}
                    </div>
                    <h3 className="font-medium text-sm truncate">{t.title}</h3>
                    <p className="text-xs text-gray-700 line-clamp-1 mt-0.5">{t.description}</p>
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
