'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarRange, Clock, MapPin, X } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { AmenityResponse, BookingResponse } from '@apartment/shared';

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  COMPLETED: 'bg-blue-500/10 text-blue-400',
};

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
      setSuccess('Booking confirmed!');
      setStartTime(''); setEndTime(''); setSelectedAmenity(null);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      await apiPost(`/api/v1/amenities/bookings/${bookingId}/cancel`);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const updateEndTime = (start: string) => {
    setStartTime(start);
    if (start && selectedAmenity) {
      const startDate = new Date(start);
      const endDate = new Date(startDate.getTime() + selectedAmenity.maxDuration * 60000);
      setEndTime(endDate.toISOString().slice(0, 16));
    }
  };

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/resident')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <div><h1 className="text-2xl font-bold text-gray-900">Book Amenities</h1><p className="text-gray-700 text-sm">Reserve clubhouse, gym, pool and more</p></div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* Booking Form */}
        {selectedAmenity && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Book {selectedAmenity.name}</h2>
              <button onClick={() => setSelectedAmenity(null)} className="p-1 hover:bg-gray-50 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-700" /></button>
            </div>
            <form onSubmit={handleBook} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input type="datetime-local" value={startTime} onChange={(e) => updateEndTime(e.target.value)} required min={new Date().toISOString().slice(0, 16)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50 [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50 [color-scheme:dark]" />
              </div>
              <div className="md:col-span-2 flex gap-4 text-xs text-gray-700">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Max {selectedAmenity.maxDuration} min</span>
                <span className="flex items-center gap-1">Advance notice: {selectedAmenity.advanceNotice}h</span>
                <span className="flex items-center gap-1">Max {selectedAmenity.maxPerUnit} booking(s)/day</span>
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition-all">{submitting ? 'Booking...' : 'Confirm Booking'}</button>
                <button type="button" onClick={() => setSelectedAmenity(null)} className="text-sm text-gray-700 hover:text-gray-900 px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Available Amenities */}
        <h2 className="text-lg font-semibold mb-4">Available Amenities</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {amenities.filter((a) => a.isActive).length === 0 ? (
            <div className="md:col-span-3 text-center py-12"><CalendarRange className="w-10 h-10 text-gray-700 mx-auto mb-3" /><p className="text-gray-700 text-sm">No amenities available</p></div>
          ) : (
            amenities.filter((a) => a.isActive).map((a) => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 border border-gray-200 hover:border-accent-500/30 transition-all group cursor-pointer" onClick={() => { setSelectedAmenity(a); setError(''); setSuccess(''); }}>
                <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center text-accent-600 mb-3 group-hover:scale-110 transition-transform">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{a.name}</h3>
                {a.description && <p className="text-xs text-gray-700 mb-3 line-clamp-2">{a.description}</p>}
                <div className="flex gap-3 text-[10px] text-gray-700">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.maxDuration}min</span>
                  <span className="flex items-center gap-1">Notice: {a.advanceNotice}h</span>
                </div>
                <button className="mt-3 text-caption text-accent-600 group-hover:text-accent-500 transition-colors">Book now →</button>
              </div>
            ))
          )}
        </div>

        {/* My Bookings */}
        <h2 className="text-lg font-semibold mb-4">My Bookings</h2>
        {myBookings.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 border border-gray-200 text-center">
            <CalendarRange className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-700 text-sm">No bookings yet</p>
            <p className="text-gray-700 text-xs mt-1">Select an amenity above to make a booking</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myBookings.map((b) => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[b.status] || ''}`}>{b.status}</span>
                      <span className="text-xs text-gray-700 font-medium">{b.amenityName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-700 mt-1">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(b.startTime).toLocaleDateString()} {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Unit {b.unitNumber}</span>
                    </div>
                  </div>
                  {b.status === 'CONFIRMED' && (
                    <button onClick={() => handleCancel(b.id)} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 hover:bg-red-500/10 rounded-lg transition-colors ml-2">Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
