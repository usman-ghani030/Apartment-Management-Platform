'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Eye, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';
import type { NoticeResponse } from '@apartment/shared';

export default function ResidentNoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeResponse[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [fetchNotices]);

  const viewNotice = async (notice: NoticeResponse) => {
    try {
      // Fetch full notice to record read receipt
      const full = await apiGet<NoticeResponse>(`/api/v1/notices/${notice.id}`);
      setSelected(full);
      // Update the list to mark as read
      setNotices((prev) => prev.map((n) => (n.id === full.id ? { ...n, hasRead: true, readCount: full.readCount } : n)));
    } catch {
      setSelected(notice);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center ">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Detail view
  if (selected) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <main className="max-w-3xl mx-auto px-6 py-8">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to notices
          </button>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium text-accent-600 bg-accent-50 rounded-full px-2.5 py-0.5 capitalize">
                {selected.category}
              </span>
              {selected.hasRead ? (
                <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Read</span>
              ) : (
                <span className="text-xs text-gray-700 flex items-center gap-1"><Clock className="w-3 h-3" /> New</span>
              )}
            </div>
            <h1 className="text-2xl font-bold mb-2">{selected.title}</h1>
            <div className="flex items-center gap-4 text-xs text-gray-700 mb-6">
              <span>By {selected.authorName}</span>
              <span>{new Date(selected.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              {selected.readCount !== undefined && <span><Eye className="w-3 h-3 inline" /> {selected.readCount} {selected.readCount === 1 ? 'read' : 'reads'}</span>}
            </div>
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {selected.content}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/resident')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notices</h1>
            <p className="text-gray-700 text-sm">Community announcements</p>
          </div>
        </div>

        {/* Notice List */}
        {notices.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No notices yet</p>
            <p className="text-gray-700 text-sm mt-1">Your community hasn't posted any announcements</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <button
                key={notice.id}
                onClick={() => viewNotice(notice)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl shadow-sm p-5 border border-gray-200 hover:border-accent-500/30 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-caption-xs font-medium text-accent-600 bg-accent-50 rounded-full px-2 py-0.5 capitalize">
                        {notice.category}
                      </span>
                      {!notice.hasRead && (
                        <span className="w-2 h-2 bg-accent-500 rounded-full" />
                      )}
                    </div>
                    <h3 className="font-semibold text-base truncate pr-4">{notice.title}</h3>
                    <p className="text-sm text-gray-700 line-clamp-1 mt-0.5">{notice.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-700">
                      <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
                      {notice.readCount !== undefined && <span><Eye className="w-3 h-3 inline" /> {notice.readCount}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-700 mt-1 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
