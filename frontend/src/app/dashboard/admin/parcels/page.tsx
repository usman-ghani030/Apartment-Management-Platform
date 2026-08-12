'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Plus, Search, CheckCircle, Building2, User, Clock, Camera, X } from 'lucide-react';
import { ApiError, apiGet, apiPost, apiPatch } from '@/lib/api';
import type { ParcelResponse } from '@apartment/shared';

const STATUS_STYLES: Record<string, string> = {
  ARRIVED: 'bg-yellow-500/10 text-yellow-400',
  COLLECTED: 'bg-green-500/10 text-green-400',
};

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
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleLogArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId || !description.trim()) return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const body: any = { unitId: selectedUnitId, description: description.trim() };
      if (photoUrl.trim()) body.photoUrl = photoUrl.trim();
      await apiPost('/api/v1/parcels', body);
      setSuccess('Parcel arrival logged successfully');
      setSelectedUnitId(''); setDescription(''); setPhotoUrl('');
      setShowForm(false);
      fetchParcels();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  const stats = {
    total: parcels.length,
    arrived: parcels.filter((p) => p.status === 'ARRIVED').length,
    collected: parcels.filter((p) => p.status === 'COLLECTED').length,
  };

  const filteredParcels = searchQuery
    ? parcels.filter(
        (p) =>
          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.loggedByUserName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : parcels;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Package Tracking</h1>
            <p className="text-gray-700 text-sm">Log and manage parcel deliveries for residents</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(''); }}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" /> Log Arrival
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200">
            <p className="text-xs text-gray-700">Total Parcels</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-yellow-500/10">
            <p className="text-xs text-yellow-400">Awaiting Collection</p>
            <p className="text-2xl font-bold mt-1">{stats.arrived}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-green-500/10">
            <p className="text-xs text-green-400">Collected</p>
            <p className="text-2xl font-bold mt-1">{stats.collected}</p>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* Log Arrival Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold mb-4">Log Parcel Arrival</h2>
            <form onSubmit={handleLogArrival} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50"
                >
                  <option value="">Select a unit...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber}{u.buildingName ? ` (${u.buildingName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Amazon package, Large box from FedEx"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL (optional)</label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition-all">
                  {submitting ? 'Logging...' : 'Log Arrival'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="text-sm text-gray-700 hover:text-gray-900 px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by description, unit, or logged by..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
            />
          </div>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
            {['ALL', 'ARRIVED', 'COLLECTED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  filter === s ? 'bg-accent-600 text-white' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Parcels List */}
        {filteredParcels.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No parcels found</p>
            <p className="text-gray-700 text-sm mt-1">
              {filter !== 'ALL' ? 'Try a different filter' : 'Log a parcel arrival using the button above'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredParcels.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-accent-500/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Parcel info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] || ''}`}>
                        {p.status}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{p.description}</span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Unit {p.unitNumber}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> Logged by: {p.loggedByUserName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                      {p.collectedByUserName && (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle className="w-3 h-3" /> Collected by: {p.collectedByUserName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {p.photoUrl && (
                      <a
                        href={p.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
                        title="View photo"
                      >
                        <Camera className="w-4 h-4" />
                      </a>
                    )}
                    {p.status === 'ARRIVED' && (
                      <button
                        onClick={() => handleMarkCollected(p.id)}
                        className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 transition-all"
                      >
                        <CheckCircle className="w-3 h-3" /> Mark Collected
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
