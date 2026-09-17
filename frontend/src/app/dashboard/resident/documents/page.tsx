'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Folder, FileText, FileImage, FileVideo, FileSpreadsheet,
  Download, X, Search,
} from 'lucide-react';
import { Field } from '@/components/ui/Field';
import { apiGet, ApiError } from '@/lib/api';
import type { DocumentFolderResponse, DocumentResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Helpers ────────────────────────────────────────────────────────────
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

export default function ResidentDocumentsPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<DocumentFolderResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Fetched once, filtered in the browser, so folder switches and typing are
  // instant.
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
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rootFolders = folders.filter((f) => !f.parentId);
  const countInFolder = (folderId: string | null) => documents.filter((d) => d.folderId === folderId).length;

  const inFolder = selectedFolder ? documents.filter((d) => d.folderId === selectedFolder) : documents;
  const currentFolderName = selectedFolder
    ? folders.find((f) => f.id === selectedFolder)?.name || 'Folder'
    : 'All documents';

  const q = query.trim().toLowerCase();
  const visible = q
    ? inFolder.filter((d) =>
        [d.name, d.description || '', fileMeta(d.mimeType).label].some((v) => v.toLowerCase().includes(q))
      )
    : inFolder;

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
    <div className="min-h-screen text-gray-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/resident')}
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
              <p className="text-body-sm text-gray-500">Bylaws, minutes and records your committee has shared</p>
            </div>
          </div>
        </div>

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
                  Your committee has not created any folders yet.
                </p>
              )}

              {rootFolders.map((f) => (
                <div key={f.id}>
                  <button
                    onClick={() => setSelectedFolder(f.id)}
                    aria-current={selectedFolder === f.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-body-sm transition-all ${
                      selectedFolder === f.id
                        ? 'bg-accent-50 font-semibold text-accent-700 ring-1 ring-accent-200/70'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Folder className={`h-4 w-4 flex-shrink-0 ${selectedFolder === f.id ? 'text-accent-600' : 'text-gray-400'}`} />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className={`flex-shrink-0 text-caption-xs tabular-nums ${selectedFolder === f.id ? 'text-accent-600' : 'text-gray-400'}`}>
                      {countInFolder(f.id)}
                    </span>
                  </button>

                  {folders
                    .filter((cf) => cf.parentId === f.id)
                    .map((cf) => (
                      <button
                        key={cf.id}
                        onClick={() => setSelectedFolder(cf.id)}
                        aria-current={selectedFolder === cf.id ? 'true' : undefined}
                        className={`ml-4 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-body-sm transition-all ${
                          selectedFolder === cf.id
                            ? 'bg-accent-50 font-semibold text-accent-700 ring-1 ring-accent-200/70'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Folder className={`h-3.5 w-3.5 flex-shrink-0 ${selectedFolder === cf.id ? 'text-accent-600' : 'text-gray-400'}`} />
                        <span className="min-w-0 flex-1 truncate">{cf.name}</span>
                        <span className={`flex-shrink-0 text-caption-xs tabular-nums ${selectedFolder === cf.id ? 'text-accent-600' : 'text-gray-400'}`}>
                          {countInFolder(cf.id)}
                        </span>
                      </button>
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
                  placeholder="Search documents..."
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
                    : 'Your committee will publish documents here as they are added.'}
                </p>
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" /> Clear search
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

                        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3.5 sm:w-auto sm:flex-shrink-0 sm:grid-cols-3">
                          <Field label="Type">{meta.label}</Field>
                          <Field label="Size">{formatSize(d.fileSize)}</Field>
                          <Field label="Added" hint={d.folderName || undefined}>
                            {shortDate(d.createdAt)}
                          </Field>
                        </div>

                        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0">
                          <a
                            href={`${API_BASE}${d.fileUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-body-sm font-medium text-accent-700 transition-all hover:border-accent-300 hover:bg-accent-100"
                          >
                            <Download className="h-3.5 w-3.5" /> View
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
