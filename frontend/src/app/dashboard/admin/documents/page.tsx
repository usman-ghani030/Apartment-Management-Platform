'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Folder, FolderPlus, FileText, FileImage, FileVideo, FileSpreadsheet,
  Upload, Download, Trash2, X, Search, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { apiGet, apiPost, apiDelete, apiUpload, ApiError } from '@/lib/api';
import type { DocumentFolderResponse, DocumentResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Helpers ────────────────────────────────────────────────────────────
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

/** File type drives the icon; the chip stays on the single accent colour. */
function fileMeta(mimeType: string) {
  if (mimeType.startsWith('image/')) return { icon: FileImage, label: 'Image' };
  if (mimeType.startsWith('video/')) return { icon: FileVideo, label: 'Video' };
  if (mimeType.includes('pdf')) return { icon: FileText, label: 'PDF' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('sheet'))
    return { icon: FileSpreadsheet, label: 'Spreadsheet' };
  if (mimeType.includes('word') || mimeType.includes('document')) return { icon: FileText, label: 'Document' };
  return { icon: FileText, label: 'File' };
}

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<DocumentFolderResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Everything is fetched once and filtered in the browser, so switching
  // folders and typing a search are instant.
  const fetchData = useCallback(async () => {
    try {
      const [foldersData, docsData] = await Promise.all([
        apiGet<DocumentFolderResponse[]>('/api/v1/documents/folders'),
        apiGet<DocumentResponse[]>('/api/v1/documents'),
      ]);
      setFolders(foldersData || []);
      setDocuments(docsData || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
      else if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rootFolders = folders.filter((f) => !f.parentId);
  const childFolders = (parentId: string) => folders.filter((f) => f.parentId === parentId);
  const countInFolder = (folderId: string | null) =>
    documents.filter((d) => d.folderId === folderId).length;

  const inFolder = selectedFolder ? documents.filter((d) => d.folderId === selectedFolder) : documents;
  const currentFolderName = selectedFolder
    ? folders.find((f) => f.id === selectedFolder)?.name || 'Folder'
    : 'All documents';

  const q = query.trim().toLowerCase();
  const visible = q
    ? inFolder.filter((d) =>
        [d.name, d.description || '', d.uploaderName || '', fileMeta(d.mimeType).label, d.folderName || ''].some((v) =>
          v.toLowerCase().includes(q)
        )
      )
    : inFolder;
  // ── Actions ──────────────────────────────────────────────────────────
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await apiPost('/api/v1/documents/folders', { name: newFolderName.trim(), parentId: selectedFolder });
      setNewFolderName('');
      setShowNewFolder(false);
      setSuccess(`Folder "${newFolderName.trim()}" created.`);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const deleteFolder = async (id: string, name: string) => {
    try {
      await apiDelete(`/api/v1/documents/folders/${id}`);
      if (selectedFolder === id) setSelectedFolder(null);
      setSuccess(`Folder "${name}" deleted.`);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setError('Choose a file to upload');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadName || uploadFile.name);
      if (uploadDescription) formData.append('description', uploadDescription);
      if (selectedFolder) formData.append('folderId', selectedFolder);

      await apiUpload('/api/v1/documents/upload', formData);

      setUploadName('');
      setUploadDescription('');
      setUploadFile(null);
      setShowUpload(false);
      setSuccess(`${uploadFile.name} uploaded.`);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (id: string, name: string) => {
    try {
      await apiDelete(`/api/v1/documents/${id}`);
      setSuccess(`"${name}" deleted.`);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/admin')}
              aria-label="Back to dashboard"
              className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200 shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
                <Folder className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-display-sm font-display text-gray-900">Documents</h1>
                <p className="text-body-sm text-gray-500">Bylaws, minutes and society records in one place</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setShowUpload(false);
                setShowNewFolder(true);
                setError('');
                setSuccess('');
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:bg-accent-50/60 hover:text-accent-700"
            >
              <FolderPlus className="h-4 w-4" /> New folder
            </button>
            <button
              onClick={() => {
                setShowNewFolder(false);
                setShowUpload(true);
                setError('');
                setSuccess('');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:-translate-y-0.5 hover:bg-accent-700"
            >
              <Upload className="h-4 w-4" /> Upload
            </button>
          </div>
        </div>

        {/* ── Banners ────────────────────────────────────────────── */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-body-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-body-sm text-emerald-700">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 flex-1">{success}</span>
            <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          {/* ── Folders ──────────────────────────────────────────── */}
          <aside className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] lg:self-start">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" aria-hidden="true" />
            <div className="border-b border-gray-100 px-4 py-3.5">
              <p className="text-body-sm font-semibold text-gray-900">Folders</p>
              <p className="text-caption-xs text-gray-500">Pick a folder to narrow the list</p>
            </div>

            <div className="p-2">
              <button
                onClick={() => setSelectedFolder(null)}
                aria-current={!selectedFolder ? 'true' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-body-sm transition-all ${
                  !selectedFolder
                    ? 'bg-accent-50 font-semibold text-accent-700 ring-1 ring-accent-200/70'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Folder className={`h-4 w-4 flex-shrink-0 ${!selectedFolder ? 'text-accent-600' : 'text-gray-400'}`} />
                <span className="min-w-0 flex-1 truncate">All documents</span>
                <span className={`flex-shrink-0 text-caption-xs tabular-nums ${!selectedFolder ? 'text-accent-600' : 'text-gray-400'}`}>
                  {documents.length}
                </span>
              </button>

              {rootFolders.length === 0 && (
                <p className="px-3 py-4 text-caption-xs leading-relaxed text-gray-400">
                  No folders yet. Create one to group documents by topic.
                </p>
              )}

              {rootFolders.map((f) => (
                <div key={f.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-xl pr-1 transition-all ${
                      selectedFolder === f.id ? 'bg-accent-50 ring-1 ring-accent-200/70' : 'hover:bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedFolder(f.id)}
                      aria-current={selectedFolder === f.id ? 'true' : undefined}
                      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-body-sm transition-colors ${
                        selectedFolder === f.id ? 'font-semibold text-accent-700' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Folder className={`h-4 w-4 flex-shrink-0 ${selectedFolder === f.id ? 'text-accent-600' : 'text-gray-400'}`} />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className={`flex-shrink-0 text-caption-xs tabular-nums ${selectedFolder === f.id ? 'text-accent-600' : 'text-gray-400'}`}>
                        {countInFolder(f.id)}
                      </span>
                    </button>
                    <button
                      onClick={() => deleteFolder(f.id, f.name)}
                      title={`Delete ${f.name}`}
                      aria-label={`Delete folder ${f.name}`}
                      className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {childFolders(f.id).map((cf) => (
                    <div
                      key={cf.id}
                      className={`group ml-4 flex items-center gap-1 rounded-xl pr-1 transition-all ${
                        selectedFolder === cf.id ? 'bg-accent-50 ring-1 ring-accent-200/70' : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedFolder(cf.id)}
                        aria-current={selectedFolder === cf.id ? 'true' : undefined}
                        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-body-sm transition-colors ${
                          selectedFolder === cf.id ? 'font-semibold text-accent-700' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Folder className={`h-3.5 w-3.5 flex-shrink-0 ${selectedFolder === cf.id ? 'text-accent-600' : 'text-gray-400'}`} />
                        <span className="min-w-0 flex-1 truncate">{cf.name}</span>
                        <span className={`flex-shrink-0 text-caption-xs tabular-nums ${selectedFolder === cf.id ? 'text-accent-600' : 'text-gray-400'}`}>
                          {countInFolder(cf.id)}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteFolder(cf.id, cf.name)}
                        title={`Delete ${cf.name}`}
                        aria-label={`Delete folder ${cf.name}`}
                        className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </aside>

          {/* ── Documents ────────────────────────────────────────── */}
          <section className="min-w-0">
            <div className="mb-5 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, uploader or folder..."
                  aria-label="Search documents"
                  className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-2.5 text-caption-xs text-gray-500">
                {query
                  ? `Showing ${visible.length} of ${inFolder.length} in ${currentFolderName}`
                  : `${inFolder.length} document${inFolder.length === 1 ? '' : 's'} in ${currentFolderName}`}
              </p>
            </div>

            {visible.length === 0 ? (
              <div className="rounded-2xl border border-gray-200/80 bg-white p-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
                  {query ? <Search className="h-6 w-6 text-accent-500" /> : <FileText className="h-6 w-6 text-accent-500" />}
                </div>
                <h3 className="mb-2 text-title font-display text-gray-900">
                  {query ? 'Nothing matched that search' : 'No documents here yet'}
                </h3>
                <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
                  {query
                    ? `No file in ${currentFolderName} matches "${query}".`
                    : 'Upload a PDF, photo or spreadsheet and it will be available to your residents.'}
                </p>
                {query ? (
                  <button
                    onClick={() => setQuery('')}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" /> Clear search
                  </button>
                ) : (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
                  >
                    <Upload className="h-4 w-4" /> Upload a document
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((d) => {
                  const meta = fileMeta(d.mimeType);
                  const Icon = meta.icon;
                  return (
                    <article
                      key={d.id}
                      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                    >
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent-500 transition-all duration-300 group-hover:w-1.5" aria-hidden="true" />

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-4 pl-6 pr-5">
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-accent-50 ring-1 ring-accent-100 transition-transform duration-300 group-hover:scale-105">
                            <Icon className="h-4.5 w-4.5 text-accent-600" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-body-sm font-semibold text-gray-900">{d.name}</h3>
                            {d.description ? (
                              <p className="mt-0.5 line-clamp-1 text-caption-xs text-gray-500">{d.description}</p>
                            ) : (
                              <p className="mt-0.5 text-caption-xs text-gray-400">{meta.label}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3.5 sm:w-auto sm:flex-shrink-0 sm:grid-cols-4">
                          <Field label="Type">{meta.label}</Field>
                          <Field label="Size">{formatSize(d.fileSize)}</Field>
                          <Field label="Uploaded by" hint={d.folderName || undefined}>
                            {d.uploaderName || 'Unknown'}
                          </Field>
                          <Field label="Added">{timeAgo(d.createdAt)}</Field>
                        </div>

                        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0">
                          <a
                            href={`${API_BASE}${d.fileUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-body-sm font-medium text-accent-700 transition-all hover:border-accent-300 hover:bg-accent-100"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </a>
                          <button
                            onClick={() => deleteDoc(d.id, d.name)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── New folder ─────────────────────────────────────────── */}
      <Modal
        open={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        icon={FolderPlus}
        title="New folder"
        subtitle={selectedFolder ? `Created inside ${currentFolderName}` : 'Created at the top level'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className={fieldLabel} htmlFor="folder-name">
              Folder name
            </label>
            <input
              id="folder-name"
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              placeholder="e.g. Meeting minutes"
              className={fieldInput}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowNewFolder(false)}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createFolder}
              disabled={!newFolderName.trim()}
              className="flex-[1.3] rounded-xl bg-accent-600 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              Create folder
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Upload ─────────────────────────────────────────────── */}
      <Modal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        icon={Upload}
        title="Upload a document"
        subtitle={selectedFolder ? `Goes into ${currentFolderName}` : 'Goes into the top level'}
        size="md"
      >
        <form onSubmit={handleUpload} className="space-y-5">
          <div>
            <span className={fieldLabel}>File</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 px-4 py-4 transition-colors hover:border-accent-300 hover:bg-accent-50/40">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50">
                <Upload className="h-4.5 w-4.5 text-accent-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-medium text-gray-800">
                  {uploadFile ? uploadFile.name : 'Choose a file to upload'}
                </span>
                <span className="mt-0.5 block text-caption-xs text-gray-500">
                  {uploadFile ? formatSize(uploadFile.size) : 'PDF, image, spreadsheet or document'}
                </span>
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="doc-name">
              Display name (optional)
            </label>
            <input
              id="doc-name"
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Defaults to the file name"
              className={fieldInput}
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="doc-description">
              Description (optional)
            </label>
            <textarea
              id="doc-description"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              rows={3}
              placeholder="What is this file for?"
              className={`${fieldInput} resize-y`}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !uploadFile}
              className="flex-[1.3] rounded-xl bg-accent-600 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {uploading ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
