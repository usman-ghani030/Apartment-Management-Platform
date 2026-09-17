'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Plus, Search, CheckCircle2, Building2, User, Clock,
  X, ImagePlus, AlertTriangle,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { ApiError, apiGet, apiPost, apiPatch, apiUpload } from '@/lib/api';
import type { ParcelResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const STATUS_META: Record<string, { pill: string; bar: string; chip: string; label: string }> = {
  ARRIVED: {
    pill: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    bar: 'bg-amber-400',
    chip: 'from-amber-400 to-amber-500 ring-amber-200',
    label: 'Awaiting collection',
  },
  COLLECTED: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    bar: 'bg-emerald-500',
    chip: 'from-emerald-500 to-emerald-600 ring-emerald-200',
    label: 'Collected',
  },
};

const FALLBACK_STATUS = STATUS_META.ARRIVED;
const statusMeta = (status: string) => STATUS_META[status] || FALLBACK_STATUS;

const FILTERS = ['ALL', 'ARRIVED', 'COLLECTED'] as const;
type StatusFilter = (typeof FILTERS)[number];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface UnitOption {
  id: string;
  unitNumber: string;
  buildingName: string;
}

export default function AdminParcelsPage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<ParcelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchParcels = useCallback(async () => {
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : '';
      const data = await apiGet<ParcelResponse[]>(`/api/v1/parcels${params}`);
      setParcels(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router, filter]);

  useEffect(() => { fetchParcels(); }, [fetchParcels]);

  useEffect(() => {
    // Load units for the dropdown
    apiGet<any[]>('/api/v1/units')
      .then((data) => {
        const opts = (data || []).map((u: any) => ({
          id: u.id,
          unitNumber: u.unitNumber,
          buildingName: u.building?.name || '',
        }));
        setUnits(opts);
      })
      .catch(() => {});
  }, []);

  const handleMarkCollected = async (id: string) => {
    setError(''); setSuccess('');
    try {
      await apiPatch(`/api/v1/parcels/${id}`, { status: 'COLLECTED' });
      setSuccess('Parcel marked as collected');
      fetchParcels();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handlePhotoSelect = (file: File | null) => {
    setPhotoFile(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview('');
      setPhotoUrl('');
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoUrl('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const resetForm = () => {
    setSelectedUnitId(''); setDescription('');
    setPhotoUrl(''); setPhotoFile(null); setPhotoPreview('');
    if (photoInputRef.current) photoInputRef.current.value = '';
    setShowForm(false); setError('');
  };

  const handleLogArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId || !description.trim()) return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      // Upload the photo first (if chosen), then create the parcel with the returned URL
      let uploadedUrl = photoUrl;
      if (photoFile) {
        setUploadingPhoto(true);
        const formData = new FormData();
        formData.append('photo', photoFile);
        const res = await apiUpload<{ url: string }>('/api/v1/parcels/photo', formData);
        uploadedUrl = res.url;
      }
      const body: any = { unitId: selectedUnitId, description: description.trim() };
      if (uploadedUrl) body.photoUrl = uploadedUrl;
      await apiPost('/api/v1/parcels', body);
      setSuccess('Parcel arrival logged');
      resetForm();
      fetchParcels();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setUploadingPhoto(false); setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading parcels...</p>
        </div>
      </div>
    );
  }

  const counts: Record<StatusFilter, number> = {
    ALL: parcels.length,
    ARRIVED: parcels.filter((p) => p.status === 'ARRIVED').length,
    COLLECTED: parcels.filter((p) => p.status === 'COLLECTED').length,
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredParcels = q
    ? parcels.filter(
        (p) =>
          p.description.toLowerCase().includes(q) ||
          p.unitNumber.toLowerCase().includes(q) ||
          p.loggedByUserName.toLowerCase().includes(q)
      )
    : parcels;

  const photoSrc = (url: string) => (url.startsWith('http') ? url : `${API_BASE}${url}`);

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/admin')}
            aria-label="Back to dashboard"
            className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Packages</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Parcels received at the gate and waiting for their resident.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setError(''); }}
            className="flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> Log arrival
          </button>
        </div>

        {/* Banners */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 w-4 h-4 flex-shrink-0 text-red-600" />
            <p className="flex-1 text-body-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <CheckCircle2 className="mt-0.5 w-4 h-4 flex-shrink-0 text-emerald-600" />
            <p className="flex-1 text-body-sm text-emerald-700">{success}</p>
            <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search + filter */}
        {parcels.length > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by description, unit, or logged by..."
                aria-label="Search parcels"
                className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Status</span>
              {FILTERS.map((s) => {
                const active = filter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-body-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,1)]'
                        : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {s === 'ALL' ? 'All' : statusMeta(s).label}
                    <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>
                      {counts[s]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Parcel list */}
        {filteredParcels.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <Package className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">
              {q ? 'No parcels match your search' : filter !== 'ALL' ? `No ${statusMeta(filter).label.toLowerCase()} parcels` : 'No parcels yet'}
            </h3>
            <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
              {q
                ? `Nothing matched “${searchQuery.trim()}”. Try another description or unit.`
                : filter !== 'ALL'
                  ? 'Try another status filter to see the rest.'
                  : 'Log a parcel when it arrives at the gate and the resident gets notified.'}
            </p>
            <button
              onClick={() => { setShowForm(true); setError(''); }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <Plus className="w-4 h-4" /> Log arrival
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredParcels.map((p) => {
              const meta = statusMeta(p.status);
              return (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-4 py-5 pl-6 pr-5">
                    {p.photoUrl ? (
                      <a
                        href={photoSrc(p.photoUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View parcel photo"
                        className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-gray-50 transition-transform duration-300 group-hover:scale-105"
                      >
                        <img src={photoSrc(p.photoUrl)} alt={`Parcel ${p.description}`} className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.chip} ring-1 transition-transform duration-300 group-hover:scale-105`}>
                        <Package className="w-5 h-5 text-white" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="truncate text-title-sm font-display text-gray-900">{p.description}</h3>
                        <span className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'COLLECTED' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          Unit {p.unitNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <User className="w-3 h-3 text-gray-400" />
                          Logged by {p.loggedByUserName}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatDate(p.createdAt)}
                        </span>
                        {p.collectedByUserName && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-caption-xs text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Collected by {p.collectedByUserName}
                          </span>
                        )}
                      </div>
                    </div>

                    {p.status === 'ARRIVED' && (
                      <div className="flex w-full items-center justify-end sm:w-auto sm:flex-shrink-0">
                        <button
                          onClick={() => handleMarkCollected(p.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark collected
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Log arrival ─────────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={resetForm}
        icon={Package}
        title="Log parcel arrival"
        subtitle="Record what arrived and which unit it belongs to."
        size="md"
      >
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleLogArrival} className="space-y-6">
          <div>
            <label className={fieldLabel} htmlFor="parcel-unit">Unit</label>
            <Select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} required>
              <option value="">Select a unit...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.unitNumber}{u.buildingName ? ` (${u.buildingName})` : ''}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="parcel-description">Description</label>
            <input
              id="parcel-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Amazon package, Large box from FedEx"
              required
              maxLength={200}
              className={fieldInput}
            />
            <p className="mt-2 text-caption-xs text-gray-400">The resident sees this text in their app.</p>
          </div>

          {/* Photo */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Photo</span>
              <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
              <span className="text-caption-xs text-gray-400">Optional</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 p-4">
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Parcel photo preview" className="h-24 w-24 rounded-xl object-cover ring-1 ring-gray-200/80" />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    aria-label="Remove photo"
                    className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white shadow-sm transition-colors hover:bg-red-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200/70">
                  <ImagePlus className="w-6 h-6 text-gray-300" />
                </div>
              )}
              <div className="min-w-[12rem] flex-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-3.5 py-2 text-body-sm font-medium text-accent-700 transition-all hover:bg-accent-100">
                  <ImagePlus className="w-4 h-4" />
                  {photoPreview ? 'Change photo' : 'Choose photo'}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <p className="mt-2 text-caption-xs text-gray-400">JPEG, PNG, WebP or GIF.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingPhoto}
              className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:opacity-50"
            >
              <Package className="w-4 h-4" />
              {uploadingPhoto ? 'Uploading photo...' : submitting ? 'Logging...' : 'Log arrival'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
