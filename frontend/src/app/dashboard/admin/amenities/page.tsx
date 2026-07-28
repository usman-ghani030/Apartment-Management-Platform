'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CalendarRange, Clock, Users, Power, PowerOff } from 'lucide-react';
import { ApiError, apiGet, apiPost, apiPatch } from '@/lib/api';
import type { AmenityResponse, BookingResponse } from '@apartment/shared';

export default function AdminAmenitiesPage() {
  const router = useRouter();
  const [amenities, setAmenities] = useState<AmenityResponse[]>([]);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
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
  const [selectedAmenityId, setSelectedAmenityId] = useState<string | null>(null);
  const [showBookings, setShowBookings] = useState<string | null>(null);

  const fetchAmenities = useCallback(async () => {
    try {
      const data = await apiGet<AmenityResponse[]>('/api/v1/amenities');
      setAmenities(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  const fetchBookings = useCallback(async (amenityId?: string) => {
    try {
      const params = amenityId ? `?amenityId=${amenityId}` : '';
      const data = await apiGet<BookingResponse[]>(`/api/v1/amenities/bookings${params}`);
      setBookings(data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAmenities(); }, [fetchAmenities]);

  useEffect(() => {
    if (showBookings) fetchBookings(showBookings);
  }, [showBookings, fetchBookings]);

  const resetForm = () => {
    setName(''); setDescription(''); setMaxDuration('120');
    setAdvanceNotice('24'); setMaxPerUnit('2'); setEditingId(null);
    setShowForm(false); setError('');
  };

  const handleEdit = (a: AmenityResponse) => {
    setName(a.name); setDescription(a.description || '');
    setMaxDuration(String(a.maxDuration)); setAdvanceNotice(String(a.advanceNotice));
    setMaxPerUnit(String(a.maxPerUnit)); setEditingId(a.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const body = {
        name, description: description || undefined,
        maxDuration: parseInt(maxDuration, 10),
        advanceNotice: parseInt(advanceNotice, 10),
        maxPerUnit: parseInt(maxPerUnit, 10),
      };
      if (editingId) {
        await apiPatch(`/api/v1/amenities/${editingId}`, body);
      } else {
        await apiPost('/api/v1/amenities', body);
      }
      resetForm();
      fetchAmenities();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const toggleActive = async (a: AmenityResponse) => {
    try {
      await apiPatch(`/api/v1/amenities/${a.id}`, { isActive: !a.isActive });
      fetchAmenities();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
            <div><h1 className="text-2xl font-bold text-gray-900">Amenities</h1><p className="text-gray-700 text-sm">Manage clubhouse, gym, pool and more</p></div>
          </div>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Plus className="w-4 h-4" /> Add Amenity</button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit Amenity' : 'Add New Amenity'}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clubhouse, Swimming Pool" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Amenity details and rules" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 resize-y" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Duration (minutes)</label>
                <input type="number" min="15" step="15" value={maxDuration} onChange={(e) => setMaxDuration(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Notice (hours)</label>
                <input type="number" min="0" value={advanceNotice} onChange={(e) => setAdvanceNotice(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings Per Unit Per Day</label>
                <input type="number" min="1" value={maxPerUnit} onChange={(e) => setMaxPerUnit(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="bg-accent-600 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition-all">{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                <button type="button" onClick={resetForm} className="text-sm text-gray-700 hover:text-white px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Amenities List */}
        {amenities.length === 0 ? (
          <div className="text-center py-20"><CalendarRange className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No amenities yet</p><p className="text-gray-700 text-sm mt-1">Add your first amenity to get started</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {amenities.map((a) => (
              <div key={a.id} className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 border transition-all ${a.isActive ? 'border-gray-200' : 'border-gray-800/50 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${a.isActive ? 'bg-pink-500/10 text-accent-500' : 'bg-gray-500/10 text-gray-700'} rounded-lg flex items-center justify-center`}>
                      <CalendarRange className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{a.name}</h3>
                      {a.description && <p className="text-xs text-gray-700 mt-0.5">{a.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(a)} className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors" title={a.isActive ? 'Deactivate' : 'Activate'}>
                      {a.isActive ? <Power className="w-4 h-4 text-green-400" /> : <PowerOff className="w-4 h-4 text-gray-700" />}
                    </button>
                    <button onClick={() => handleEdit(a)} className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 hover:text-gray-900">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-700">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.maxDuration} min</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {a.maxPerUnit}/day</span>
                  <span className="flex items-center gap-1">Adv: {a.advanceNotice}h</span>
                </div>
                <button
                  onClick={() => setShowBookings(showBookings === a.id ? null : a.id)}
                  className="mt-3 text-xs text-accent-500 hover:text-accent-400 transition-colors"
                >
                  {showBookings === a.id ? 'Hide bookings' : 'View bookings'}
                </button>

                {/* Bookings for this amenity */}
                {showBookings === a.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {bookings.length === 0 ? (
                      <p className="text-xs text-gray-700 text-center py-3">No bookings yet</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {bookings.map((b) => (
                          <div key={b.id} className="text-xs bg-gray-50 rounded-lg p-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-700">{b.residentName}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                b.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-400' : b.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                              }`}>{b.status}</span>
                            </div>
                            <p className="text-gray-700 mt-0.5">Unit {b.unitNumber} · {new Date(b.startTime).toLocaleDateString()} {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
