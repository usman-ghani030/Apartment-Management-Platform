'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Folder, File, Download, Clock } from 'lucide-react';
import { ApiError, apiGet } from '@/lib/api';
import type { DocumentFolderResponse, DocumentResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ResidentDocumentsPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<DocumentFolderResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [foldersData, docsData] = await Promise.all([
        apiGet<DocumentFolderResponse[]>('/api/v1/documents/folders'),
        apiGet<DocumentResponse[]>(`/api/v1/documents${selectedFolder ? `?folderId=${selectedFolder}` : ''}`),
      ]);
      setFolders(foldersData || []);
      setDocuments(docsData || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router, selectedFolder]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
    return '📎';
  };

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  const rootFolders = folders.filter((f) => !f.parentId);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/resident')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <div><h1 className="text-2xl font-bold text-gray-900">Documents</h1><p className="text-gray-700 text-sm">View society documents and records</p></div>
        </div>

        <div className="flex gap-6">
          {/* Folder Tree */}
          <div className="w-56 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button onClick={() => setSelectedFolder(null)} className={`w-full text-left px-4 py-3 text-sm transition-colors ${!selectedFolder ? 'bg-accent-50 text-accent-500' : 'hover:bg-gray-50 text-gray-700'}`}>
                <Folder className="w-4 h-4 inline mr-2" />All Documents
              </button>
              {rootFolders.map((f) => (
                <button key={f.id} onClick={() => setSelectedFolder(f.id)} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedFolder === f.id ? 'bg-accent-50 text-accent-500' : 'hover:bg-gray-50 text-gray-700'}`}>
                  <Folder className="w-4 h-4 inline mr-2" />{f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 min-w-0">
            {documents.length === 0 ? (
              <div className="text-center py-16"><File className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No documents available</p></div>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200 hover:border-gray-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="text-xl flex-shrink-0">{getFileIcon(d.mimeType)}</div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate">{d.name}</h3>
                          <div className="flex items-center gap-3 text-[10px] text-gray-700 mt-0.5">
                            <span>{formatSize(d.fileSize)}</span>
                            <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <a href={`${API_BASE}${d.fileUrl}`} target="_blank" className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-400 px-3 py-1.5 hover:bg-accent-50 rounded-lg transition-colors">
                        <Download className="w-3.5 h-3.5" /> View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
