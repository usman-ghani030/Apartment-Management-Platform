'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarRange, Clock, MapPin, X, Check, CalendarCheck2,
  Timer, CalendarClock, Repeat,
} from 'lucide-react';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Panel, CountPill, PanelEmpty } from '@/components/ui/Panel';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { AmenityResponse, BookingResponse } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Amenity bookings: pick a facility, pick a slot, cancel if plans change.
// Same endpoints and payloads as before, rebuilt on the design system. The
// datetime inputs previously carried a dark-theme `color-scheme: dark` hint,
// which made the picker unreadable on the light dashboard - removed.
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'info' | 'neutral' | 'danger';

const STATUS_META: Record<string, { label: string; badge: BadgeVariant; rail: string }> = {
  CONFIRMED: { label: 'Confirmed', badge: 'success', rail: 'bg-emerald-500' },
  COMPLETED: { label: 'Completed', badge: 'info', rail: 'bg-accent-500' },
  CANCELLED: { label: 'Cancelled', badge: 'danger', rail: 'bg-gray-300' },
};

const metaFor = (status: string) =>
  STATUS_META[status] || { label: status, badge: 'neutral' as BadgeVariant, rail: 'bg-gray-300' };

const nowLocalInput = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function ResidentAmenitiesPage() {
  const router = useRouter();
  const [amenities, setAmenities] = useState<AmenityResponse[]>([]);
  const [myBookings, setMyBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAmenity, setSelectedAmenity] = useState<AmenityResponse | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [amenitiesData, bookingsData] = await Promise.all([
        apiGet<AmenityResponse[]>('/api/v1/amenities'),
        apiGet<BookingResponse[]>('/api/v1/amenities/bookings'),
      ]);
      setAmenities(amenitiesData || []);
      setMyBookings(bookingsData || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openBooking = (amenity: AmenityResponse) => {
    setSelectedAmenity(amenity);
    setStartTime('');
    setEndTime('');
    setError('');
    setSuccess('');
  };

  const closeBooking = () => {
    setSelectedAmenity(null);
    setStartTime('');
    setEndTime('');
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmenity) return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      await apiPost('/api/v1/amenities/book', {
        amenityId: selectedAmenity.id,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setSuccess(`${selectedAmenity.name} booked. See it under My bookings below.`);
      closeBooking();
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (bookingId: string) => {
    setCancellingId(bookingId);
    setError('');
    try {
      await apiPost(`/api/v1/amenities/bookings/${bookingId}/cancel`);
      setSuccess('Booking cancelled.');
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setCancellingId(null); }
  };

  // Picking a start time fills the end time from the amenity's own max duration.
  const updateEndTime = (start: string) => {
    setStartTime(start);
    if (start && selectedAmenity) {
      const startDate = new Date(start);
      const endDate = new Date(startDate.getTime() + selectedAmenity.maxDuration * 60000);
      setEndTime(endDate.toISOString().slice(0, 16));
    }
  };

  if (loading) return <PageSkeleton width="max-w-6xl" />;

  const available = amenities.filter((a) => a.isActive);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/resident')}
          aria-label="Back to dashboard"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-display-sm font-display text-gray-900">Book amenities</h1>
            <p className="text-body-sm text-gray-500">Clubhouse, gym, pool and everything else your society shares</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <p className="flex-1 text-body-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <p className="flex-1 text-body-sm text-emerald-700">{success}</p>
          <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Available amenities ─────────────────────────────────────── */}
      <Panel
        icon={CalendarRange}
        title="Available amenities"
        hint={available.length === 0 ? 'Your committee has not opened any bookings' : 'Pick one to see available rules and book a slot'}
        meta={<CountPill tone={available.length === 0 ? 'neutral' : 'accent'}>{available.length}</CountPill>}
      >
        {available.length === 0 ? (
          <PanelEmpty
            icon={CalendarRange}
            title="No amenities available"
            description="When your committee opens clubhouse, gym or pool bookings, they will show up here."
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {available.map((a) => (
              <article
                key={a.id}
                className="group flex flex-col rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_12px_28px_-16px_rgba(37,99,235,0.4)]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-transform duration-300 group-hover:scale-105">
                    <CalendarRange className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-body font-semibold text-gray-900">{a.name}</h3>
                    <p className="mt-1 line-clamp-2 text-caption-xs leading-relaxed text-gray-500">
                      {a.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-caption-xs text-gray-500">
                  <li className="flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5 flex-shrink-0 text-accent-500" />
                    Up to {a.maxDuration} minutes per booking
                  </li>
                  <li className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 flex-shrink-0 text-accent-500" />
                    {a.advanceNotice > 0 ? `Book at least ${a.advanceNotice}h ahead` : 'No advance notice needed'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5 flex-shrink-0 text-accent-500" />
                    {a.maxPerUnit} booking{a.maxPerUnit === 1 ? '' : 's'} per unit per day
                  </li>
                </ul>

                <button
                  onClick={() => openBooking(a)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700"
                >
                  <CalendarRange className="h-3.5 w-3.5" /> Book this
                </button>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {/* ── My bookings ─────────────────────────────────────────────── */}
      <Panel
        icon={CalendarCheck2}
        title="My bookings"
        hint={myBookings.length === 0 ? 'Nothing booked yet' : 'Confirmed bookings can be cancelled here'}
        meta={<CountPill tone={myBookings.length === 0 ? 'neutral' : 'accent'}>{myBookings.length}</CountPill>}
        className="mt-6"
      >
        {myBookings.length === 0 ? (
          <PanelEmpty
            icon={CalendarRange}
            title="No bookings yet"
            description="Book an amenity above and it will appear here with its slot and status."
            action={
              available.length > 0 ? (
                <button
                  onClick={() => openBooking(available[0])}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700"
                >
                  <CalendarRange className="h-4 w-4" /> Book {available[0].name}
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {myBookings.map((b) => {
              const meta = metaFor(b.status);
              const st = new Date(b.startTime);
              const en = new Date(b.endTime);
              const sameDay = st.toDateString() === en.toDateString();
              return (
                <li key={b.id} className="relative">
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.rail}`} aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 pl-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
                        <h3 className="truncate text-body font-semibold text-gray-900">{b.amenityName}</h3>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption-xs text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {dayLabel(b.startTime)}
                          {sameDay
                            ? `, ${timeLabel(b.startTime)} to ${timeLabel(b.endTime)}`
                            : ` ${timeLabel(b.startTime)} to ${dayLabel(b.endTime)} ${timeLabel(b.endTime)}`}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-gray-400" /> Unit {b.unitNumber}
                        </span>
                      </div>
                    </div>

                    {b.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        disabled={cancellingId === b.id}
                        className="flex-shrink-0 rounded-xl border border-gray-200 px-3.5 py-2 text-body-sm font-medium text-gray-500 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                      >
                        {cancellingId === b.id ? 'Cancelling...' : 'Cancel booking'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ── Booking dialog ──────────────────────────────────────────── */}
      <Modal
        open={!!selectedAmenity}
        onClose={closeBooking}
        title={selectedAmenity ? `Book ${selectedAmenity.name}` : 'Book amenity'}
        subtitle="Pick a start time and we will set the end time from the facility limit"
        icon={CalendarRange}
        footer={
          <>
            <button
              type="submit"
              form="book-amenity"
              disabled={submitting}
              className="flex-1 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {submitting ? 'Booking...' : 'Confirm booking'}
            </button>
            <button
              type="button"
              onClick={closeBooking}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </button>
          </>
        }
      >
        {selectedAmenity && (
          <form id="book-amenity" onSubmit={handleBook} className="space-y-4">
            <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 px-4 py-3.5">
              <p className="text-body-sm font-medium text-gray-700">{selectedAmenity.name}</p>
              {selectedAmenity.description && (
                <p className="mt-0.5 text-caption-xs leading-relaxed text-gray-500">{selectedAmenity.description}</p>
              )}
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-caption-xs text-gray-500">
                <li className="inline-flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-accent-500" /> Max {selectedAmenity.maxDuration} min
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-accent-500" /> Notice {selectedAmenity.advanceNotice}h
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5 text-accent-500" /> {selectedAmenity.maxPerUnit}/unit per day
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel} htmlFor="booking-start">Start time</label>
                <input
                  id="booking-start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => updateEndTime(e.target.value)}
                  required
                  min={nowLocalInput()}
                  className={fieldInput}
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="booking-end">End time</label>
                <input
                  id="booking-end"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className={fieldInput}
                />
              </div>
            </div>

            <p className="text-caption-xs leading-relaxed text-gray-400">
              The end time is filled in automatically from the facility limit and can be shortened.
            </p>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-body-sm text-red-700">{error}</p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
