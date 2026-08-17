'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, CheckCircle, User, Clock } from 'lucide-react';
import { ApiError, apiGet, apiPatch } from '@/lib/api';
import type { ParcelResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const STATUS_STYLES: Record<string, string> = {
  ARRIVED: 'bg-yellow-500/10 text-yellow-400',
  COLLECTED: 'bg-green-500/10 text-green-400',
};

export default function ResidentParcelsPage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<ParcelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchParcels = useCallback(async () => {
    try {
      const data = await apiGet<ParcelResponse[]>('/api/v1/parcels');
      setParcels(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchParcels(); }, [fetchParcels]);

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

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  const arrivedParcels = parcels.filter((p) => p.status === 'ARRIVED');
  const collectedParcels = parcels.filter((p) => p.status === 'COLLECTED');

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/resident')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
            <p className="text-gray-700 text-sm">Track your parcel deliveries</p>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* Awaiting Collection */}
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-yellow-400" />
          Awaiting Collection
          {arrivedParcels.length > 0 && (
            <span className="text-xs font-medium bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">{arrivedParcels.length}</span>
          )}
        </h2>

        {arrivedParcels.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center mb-8">
            <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-700 text-sm">No packages waiting</p>
            <p className="text-gray-700 text-xs mt-1">When a parcel arrives, it will appear here</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {arrivedParcels.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border-l-4 border-l-yellow-400">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status]}`}>ARRIVED</span>
                      <span className="text-sm font-semibold text-gray-900">{p.description}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Arrived {new Date(p.createdAt).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> Logged by: {p.loggedByUserName}
                      </span>
                    </div>
                    {p.photoUrl && (
                      <a
                        href={p.photoUrl.startsWith('http') ? p.photoUrl : `${API_BASE}${p.photoUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-16 h-16 rounded-lg overflow-hidden bg-gray-50 hover:opacity-90 transition-opacity mt-2"
                        title="View parcel photo"
                      >
                        <img src={p.photoUrl.startsWith('http') ? p.photoUrl : `${API_BASE}${p.photoUrl}`} alt={`Parcel ${p.description}`} className="w-full h-full object-cover" />
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleMarkCollected(p.id)}
                    className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg px-4 py-2 font-medium transition-all"
                  >
                    <CheckCircle className="w-4 h-4" /> Collected
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Collection History */}
        {collectedParcels.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Collection History
            </h2>
            <div className="space-y-2">
              {collectedParcels.map((p) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">COLLECTED</span>
                    <span className="text-xs text-gray-700">{p.description}</span>
                    <span className="text-[10px] text-gray-700 ml-auto">
                      {new Date(p.updatedAt).toLocaleDateString()} by {p.collectedByUserName || p.loggedByUserName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
