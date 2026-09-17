'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, CalendarRange, Clock, Users, Power, PowerOff, Edit2,
  X, CheckCircle2, AlertTriangle, BookOpen, CalendarDays,
} from 'lucide-react';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { ApiError, apiGet, apiPost, apiPatch } from '@/lib/api';
import type { AmenityResponse, BookingResponse } from '@apartment/shared';

const BOOKING_STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-200/70',
  COMPLETED: 'bg-gray-100 text-gray-600 ring-gray-200/70',
};

const bookingPill = (status: string) =>
  BOOKING_STATUS_STYLES[status] || 'bg-accent-50 text-accent-700 ring-accent-200/70';

const humanise = (value: string) =>
  value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const formatWhen = (iso: string) =>
  `${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

export default function AdminAmenitiesPage() {
  const router = useRouter();
  const [amenities, setAmenities] = useState<AmenityResponse[]>([]);
  const [allBookings, setAllBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxDuration, setMaxDuration] = useState('120');
  const [advanceNotice, setAdvanceNotice] = useState('24');
  const [maxPerUnit, setMaxPerUnit] = useState('2');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bookings open in a dialog rather than expanding inside the card, so the
  // grid rows never shift height when someone opens a booking list.
  const [bookingsFor, setBookingsFor] = useState<AmenityResponse | null>(null);
  const [modalBookings, setModalBookings] = useState<BookingResponse[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const fetchAmenities = useCallback(async () => {
    try {
      const data = await apiGet<AmenityResponse[]>('/api/v1/amenities');
      setAmenities(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  // All bookings, used for the per-card counts and the header stats.
  const fetchAllBookings = useCallback(async () => {
    try {
      setAllBookings((await apiGet<BookingResponse[]>('/api/v1/amenities/bookings')) || []);
    } catch { /* counts are best-effort */ }
  }, []);

  useEffect(() => { fetchAmenities(); fetchAllBookings(); }, [fetchAmenities, fetchAllBookings]);

  const openBookings = async (amenity: AmenityResponse) => {
    setBookingsFor(amenity);
    setModalBookings([]);
    setBookingsLoading(true);
    try {
      const data = await apiGet<BookingResponse[]>(`/api/v1/amenities/bookings?amenityId=${amenity.id}`);
      setModalBookings(
        [...(data || [])].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      );
    } catch {
      setModalBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  };

  const resetForm = () => {
    setName(''); setDescription(''); setMaxDuration('120');
    setAdvanceNotice('24'); setMaxPerUnit('2'); setEditingId(null);
    setShowForm(false); setError('');
  };

  const handleEdit = (a: AmenityResponse) => {
    setName(a.name); setDescription(a.description || '');
    setMaxDuration(String(a.maxDuration)); setAdvanceNotice(String(a.advanceNotice));
    setMaxPerUnit(String(a.maxPerUnit)); setEditingId(a.id);
    setShowForm(true); setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const body = {
        name, description: description || undefined,
        maxDuration: parseInt(maxDuration, 10),
        advanceNotice: parseInt(advanceNotice, 10),
        maxPerUnit: parseInt(maxPerUnit, 10),
      };
      if (editingId) {
        await apiPatch(`/api/v1/amenities/${editingId}`, body);
        setSuccess('Amenity updated');
      } else {
        await apiPost('/api/v1/amenities', body);
        setSuccess('Amenity added');
      }
      resetForm();
      fetchAmenities();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const toggleActive = async (a: AmenityResponse) => {
    setError(''); setSuccess('');
    try {
      await apiPatch(`/api/v1/amenities/${a.id}`, { isActive: !a.isActive });
      setSuccess(`Amenity ${a.isActive ? 'deactivated' : 'activated'}`);
      fetchAmenities();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading amenities...</p>
        </div>
      </div>
    );
  }

  const bookingCountFor = (id: string) => allBookings.filter((b) => b.amenityId === id).length;

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
            <h1 className="text-2xl font-display font-bold text-gray-900">Amenities</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Clubhouse, gym, pool and everything residents can book.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> Add amenity
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

        {/* Amenity grid */}
        {amenities.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <CalendarRange className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No amenities yet</h3>
            <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
              Add your first bookable space so residents can reserve it with the rules you set.
            </p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <Plus className="w-4 h-4" /> Add amenity
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            {amenities.map((a) => {
              const count = bookingCountFor(a.id);
              return (
                <div
                  key={a.id}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)] ${
                    a.isActive ? '' : 'bg-gray-50/60'
                  }`}
                >
                  {/* Status rule */}
                  <span className={`absolute inset-x-0 top-0 h-1 ${a.isActive ? 'bg-accent-500' : 'bg-gray-300'}`} aria-hidden="true" />

                  <div className="flex flex-1 flex-col p-5 pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${a.isActive ? 'from-accent-500 to-accent-600 ring-accent-200' : 'from-gray-300 to-gray-400 ring-gray-200'} ring-1 transition-transform duration-300 group-hover:scale-110`}>
                        <CalendarRange className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className={`text-title-sm font-display ${a.isActive ? 'text-gray-900' : 'text-gray-500'}`}>{a.name}</h3>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                            a.isActive
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                              : 'bg-gray-100 text-gray-500 ring-gray-200/70'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${a.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            {a.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-body-sm text-gray-500">
                          {a.description || 'No description added yet.'}
                        </p>
                      </div>
                    </div>

                    {/* Booking rules */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                        <Clock className="w-3 h-3 text-gray-400" />
                        Up to {a.maxDuration} min
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                        <Users className="w-3 h-3 text-gray-400" />
                        {a.maxPerUnit} per unit / day
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                        <CalendarDays className="w-3 h-3 text-gray-400" />
                        {a.advanceNotice}h notice
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                      <button
                        onClick={() => openBookings(a)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent-600 px-3.5 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-accent-700"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> View bookings
                        <span className="rounded-full bg-white/20 px-1.5 text-[11px] font-semibold tabular-nums">{count}</span>
                      </button>
                      <button
                        onClick={() => handleEdit(a)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2.5 text-body-sm font-medium text-accent-700 transition-all hover:border-accent-300 hover:bg-accent-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => toggleActive(a)}
                        title={a.isActive ? 'Deactivate amenity' : 'Activate amenity'}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-body-sm font-medium transition-all ${
                          a.isActive
                            ? 'border-gray-200 bg-white text-gray-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {a.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        {a.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Bookings dialog ─────────────────────────────────────────── */}
      <Modal
        open={!!bookingsFor}
        onClose={() => setBookingsFor(null)}
        icon={BookOpen}
        title={bookingsFor ? `${bookingsFor.name} bookings` : 'Bookings'}
        subtitle="Most recent first."
        size="md"
      >
        {bookingsLoading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
            <p className="text-body-sm text-gray-500">Loading bookings...</p>
          </div>
        ) : modalBookings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-12">
            <CalendarRange className="w-6 h-6 text-gray-300" />
            <p className="text-body-sm text-gray-400">No bookings for this amenity yet</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {modalBookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-accent-100">
                  <span className="text-[11px] font-semibold text-accent-700">
                    {b.residentName?.trim()?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-gray-900">{b.residentName}</p>
                  <p className="mt-0.5 text-caption-xs text-gray-400">
                    Unit {b.unitNumber}
                    {' '}&middot;{' '}
                    {formatWhen(b.startTime)}
                  </p>
                </div>
                <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${bookingPill(b.status)}`}>
                  {humanise(b.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Add / Edit dialog ───────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={resetForm}
        icon={editingId ? Edit2 : CalendarRange}
        title={editingId ? 'Edit amenity' : 'Add amenity'}
        subtitle={editingId
          ? 'Update the space or the rules residents book under.'
          : 'Set up a bookable space and the rules that apply to it.'}
        size="md"
      >
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className={fieldLabel} htmlFor="amenity-name">Name</label>
              <input
                id="amenity-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Clubhouse, Swimming Pool"
                required
                className={fieldInput}
              />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="amenity-description">Description</label>
              <textarea
                id="amenity-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Amenity details and rules"
                className={`${fieldInput} resize-y`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Booking rules</span>
              <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={fieldLabel} htmlFor="amenity-duration">Max duration</label>
                <input
                  id="amenity-duration"
                  type="number" min="15" step="15"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(e.target.value)}
                  className={fieldInput}
                />
                <p className="mt-1.5 text-caption-xs text-gray-400">Minutes</p>
              </div>
              <div>
                <label className={fieldLabel} htmlFor="amenity-notice">Advance notice</label>
                <input
                  id="amenity-notice"
                  type="number" min="0"
                  value={advanceNotice}
                  onChange={(e) => setAdvanceNotice(e.target.value)}
                  className={fieldInput}
                />
                <p className="mt-1.5 text-caption-xs text-gray-400">Hours</p>
              </div>
              <div>
                <label className={fieldLabel} htmlFor="amenity-max">Per unit / day</label>
                <input
                  id="amenity-max"
                  type="number" min="1"
                  value={maxPerUnit}
                  onChange={(e) => setMaxPerUnit(e.target.value)}
                  className={fieldInput}
                />
                <p className="mt-1.5 text-caption-xs text-gray-400">Bookings</p>
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
              disabled={submitting}
              className="flex-[1.4] rounded-xl bg-accent-600 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Add amenity'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
