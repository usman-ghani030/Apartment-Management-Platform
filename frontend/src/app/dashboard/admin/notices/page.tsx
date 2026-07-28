'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, FileText, Send, Trash2, Eye, Clock, CheckCircle } from 'lucide-react';
import { ApiError, apiPost, apiGet, apiPatch, apiDelete } from '@/lib/api';
import type { NoticeResponse } from '@apartment/shared';

export default function AdminNoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [publish, setPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiPost<NoticeResponse>('/api/v1/notices', { title, content, category, publish });
      setTitle('');
      setContent('');
      setCategory('general');
      setPublish(false);
      setShowForm(false);
      fetchNotices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notice?')) return;
    try {
      await apiDelete(`/api/v1/notices/${id}`);
      fetchNotices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await apiPatch(`/api/v1/notices/${id}`, { publish: true });
      fetchNotices();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center ">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notices</h1>
              <p className="text-gray-700 text-sm">Manage community announcements</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            New Notice
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
        )}

        {/* Create Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold mb-4">Create Notice</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notice title"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
                >
                  <option value="general">General</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="event">Event</option>
                  <option value="emergency">Emergency</option>
                  <option value="billing">Billing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the notice content..."
                  required
                  rows={6}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all resize-y"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publish}
                    onChange={(e) => setPublish(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-200 bg-gray-50 text-accent-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Publish immediately</span>
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-accent-600 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
                >
                  {submitting ? 'Creating...' : publish ? <><Send className="w-4 h-4" /> Create & Publish</> : <><FileText className="w-4 h-4" /> Save Draft</>}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Notices List */}
        {notices.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No notices yet</p>
            <p className="text-gray-700 text-sm mt-1">Create your first community notice</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((notice) => (
              <div key={notice.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-medium text-accent-500 bg-accent-50 rounded-full px-2.5 py-0.5 capitalize">
                        {notice.category}
                      </span>
                      {notice.publishedAt ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Published
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Draft
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{notice.title}</h3>
                    <p className="text-sm text-gray-700 line-clamp-2">{notice.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-700">
                      <span>By {notice.authorName}</span>
                      <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
                      {notice.readCount !== undefined && <span><Eye className="w-3 h-3 inline" /> {notice.readCount} reads</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!notice.publishedAt && (
                      <button
                        onClick={() => handlePublish(notice.id)}
                        className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-green-400"
                        title="Publish"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notice.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
