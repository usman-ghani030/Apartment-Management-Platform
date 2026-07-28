'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Folder, File, Upload, Download, Trash2, X } from 'lucide-react';
import { ApiError, apiGet, apiPost, apiDelete } from '@/lib/api';
import type { DocumentFolderResponse, DocumentResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<DocumentFolderResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await apiPost('/api/v1/documents/folders', { name: newFolderName.trim(), parentId: selectedFolder });
      setNewFolderName(''); setShowNewFolder(false);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      await apiDelete(`/api/v1/documents/folders/${id}`);
      if (selectedFolder === id) setSelectedFolder(null);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) { setError('Please select a file'); return; }

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadName || uploadFile.name);
      if (uploadDescription) formData.append('description', uploadDescription);
      if (selectedFolder) formData.append('folderId', selectedFolder);

      const res = await fetch(`${API_BASE}/api/v1/documents/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = await res.json();
      if (json.error) throw new ApiError(json.error.code, json.error.message, res.status);

      setUploadName(''); setUploadDescription(''); setUploadFile(null); setShowUpload(false);
      setSuccess('File uploaded!');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Upload failed');
    }
  };

  const deleteDoc = async (id: string) => {
    try {
      await apiDelete(`/api/v1/documents/${id}`);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

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

  if (loading) return <div className="min-h-screen bg-white text-gray-900 bg-surface flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  const rootFolders = folders.filter((f) => !f.parentId);
  const childFolders = (parentId: string) => folders.filter((f) => f.parentId === parentId);

  return (
    <div className="min-h-screen bg-white text-gray-900 bg-surface">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
            <div><h1 className="text-2xl font-bold text-gray-900">Documents</h1><p className="text-gray-700 text-sm">Manage society documents, bylaws, and records</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowNewFolder(!showNewFolder); setShowUpload(false); }} className="flex items-center gap-2 bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Folder className="w-4 h-4" /> New Folder</button>
            <button onClick={() => { setShowUpload(!showUpload); setShowNewFolder(false); }} className="flex items-center gap-2 bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Upload className="w-4 h-4" /> Upload</button>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* New Folder Form */}
        {showNewFolder && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 border border-gray-200 mb-6 flex gap-3 items-center">
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm  placeholder-gray-500 focus:outline-none focus:border-accent-500/50" onKeyDown={(e) => e.key === 'Enter' && createFolder()} />
            <button onClick={createFolder} className="bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all">Create</button>
            <button onClick={() => setShowNewFolder(false)} className="text-gray-700 hover:text-gray-900 p-2"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Upload Form */}
        {showUpload && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-6">
            <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input type="file" ref={fileInputRef} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-500/10 file:text-accent-500 hover:file:bg-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name (optional)</label>
                <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Defaults to filename" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm  placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm  placeholder-gray-500 focus:outline-none focus:border-accent-500/50 resize-y" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-6 py-2 text-sm font-medium transition-all">Upload</button>
                <button type="button" onClick={() => setShowUpload(false)} className="text-sm text-gray-700 hover:text-gray-900 px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="flex gap-6">
          {/* Folder Tree */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button onClick={() => setSelectedFolder(null)} className={`w-full text-left px-4 py-3 text-sm transition-colors ${!selectedFolder ? 'bg-blue-500/10 text-accent-500' : 'hover:bg-gray-50 text-gray-700'}`}>
                <Folder className="w-4 h-4 inline mr-2" />All Documents
              </button>
              {rootFolders.map((f) => (
                <div key={f.id}>
                  <div className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors group ${selectedFolder === f.id ? 'bg-blue-500/10 text-accent-500' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <button onClick={() => setSelectedFolder(f.id)} className="flex-1 text-left"><Folder className="w-4 h-4 inline mr-2" />{f.name}</button>
                    <button onClick={() => deleteFolder(f.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {childFolders(f.id).map((cf) => (
                    <div key={cf.id} className={`flex items-center justify-between pl-8 pr-4 py-2 text-sm transition-colors group ${selectedFolder === cf.id ? 'bg-blue-500/10 text-accent-500' : 'hover:bg-gray-50 text-gray-700'}`}>
                      <button onClick={() => setSelectedFolder(cf.id)} className="flex-1 text-left"><Folder className="w-3.5 h-3.5 inline mr-2" />{cf.name}</button>
                      <button onClick={() => deleteFolder(cf.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 min-w-0">
            {documents.length === 0 ? (
              <div className="text-center py-16"><File className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No documents in this folder</p><p className="text-gray-700 text-sm mt-1">Upload a document to get started</p></div>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200 hover:border-gray-200 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="text-xl flex-shrink-0">{getFileIcon(d.mimeType)}</div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate">{d.name}</h3>
                          <div className="flex items-center gap-3 text-[10px] text-gray-700 mt-0.5">
                            <span>{formatSize(d.fileSize)}</span>
                            <span>{d.mimeType}</span>
                            <span>by {d.uploaderName}</span>
                            <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                        <a href={`${API_BASE}${d.fileUrl}`} target="_blank" className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors text-gray-700" title="Download"><Download className="w-4 h-4" /></a>
                        <button onClick={() => deleteDoc(d.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-gray-700 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
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
