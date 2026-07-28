'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, Search, CheckCircle, XCircle, Phone, User, Car, Building2, Clock } from 'lucide-react';
import { ApiError, apiGet, apiPost, apiPatch } from '@/lib/api';
import type { VisitorPassResponse } from '@apartment/shared';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  APPROVED: 'bg-blue-500/10 text-blue-400',
  CHECKED_IN: 'bg-green-500/10 text-green-400',
  CHECKED_OUT: 'bg-gray-500/10 text-gray-700',
  EXPIRED: 'bg-red-500/10 text-red-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

const STATUS_ORDER = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED'];

export default function AdminVisitorsPage() {
  const router = useRouter();
  const [passes, setPasses] = useState<VisitorPassResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQr, setShowQr] = useState<string | null>(null);

  const fetchPasses = useCallback(async () => {
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : '';
      const data = await apiGet<VisitorPassResponse[]>(`/api/v1/visitors${params}`);
      setPasses(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router, filter]);

  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  const handleApprove = async (id: string) => {
    setError(''); setSuccess('');
    try {
      await apiPatch(`/api/v1/visitors/${id}`, { status: 'APPROVED' });
      setSuccess('Pass approved successfully');
      fetchPasses();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleCancel = async (id: string) => {
    setError(''); setSuccess('');
    try {
      await apiPost(`/api/v1/visitors/${id}/cancel`);
      setSuccess('Pass cancelled');
      fetchPasses();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  // Sort: pending first, then by status order, then by createdAt desc
  const sortedPasses = [...passes].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    if (ai !== bi) return ai - bi;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const filteredPasses = searchQuery
    ? sortedPasses.filter(
        (p) =>
          p.visitorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.visitorPhone.includes(searchQuery) ||
          p.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.residentName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedPasses;

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  const stats = {
    total: passes.length,
    pending: passes.filter((p) => p.status === 'PENDING').length,
    approved: passes.filter((p) => p.status === 'APPROVED').length,
    checkedIn: passes.filter((p) => p.status === 'CHECKED_IN').length,
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Visitor Management</h1>
            <p className="text-gray-700 text-sm">Monitor and manage all visitor passes</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200">
            <p className="text-xs text-gray-700">Total Passes</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-yellow-500/10">
            <p className="text-xs text-yellow-400">Pending</p>
            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-blue-500/10">
            <p className="text-xs text-blue-400">Approved</p>
            <p className="text-2xl font-bold mt-1">{stats.approved}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-green-500/10">
            <p className="text-xs text-green-400">Checked In</p>
            <p className="text-2xl font-bold mt-1">{stats.checkedIn}</p>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by visitor name, phone, unit, or resident..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
            />
          </div>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5 overflow-x-auto">
            {['ALL', 'PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  filter === s ? 'bg-accent-600 text-white' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Passes List */}
        {filteredPasses.length === 0 ? (
          <div className="text-center py-20">
            <QrCode className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No visitor passes found</p>
            <p className="text-gray-700 text-sm mt-1">
              {filter !== 'ALL' ? 'Try a different filter' : 'Residents will create passes when they expect visitors'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPasses.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200 hover:border-accent-500/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Visitor info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] || ''}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{p.visitorName}</span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.visitorPhone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Unit {p.unitNumber}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {p.residentName}
                      </span>
                      {p.vehicleNumber && (
                        <span className="flex items-center gap-1">
                          <Car className="w-3 h-3" /> {p.vehicleNumber}
                        </span>
                      )}
                      {p.purpose && <span>· {p.purpose}</span>}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-gray-700">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Created {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                      {p.expiresAt && (
                        <span>
                          Expires {new Date(p.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setShowQr(showQr === p.id ? null : p.id)}
                      className={`p-2 rounded-lg transition-all ${
                        showQr === p.id ? 'bg-accent-500/20 text-accent-400' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Show QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>

                    {p.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(p.id)}
                          className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 transition-all"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => handleCancel(p.id)}
                          className="flex items-center gap-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg px-3 py-1.5 transition-all"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {(p.status === 'APPROVED' || p.status === 'CHECKED_IN') && (
                      <button
                        onClick={() => handleCancel(p.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* QR Code */}
                {showQr === p.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-6">
                    <div className="bg-white p-2 rounded-lg">
                      <QrCode className="w-32 h-32 text-black" />
                    </div>
                    <div className="text-xs text-gray-700 space-y-1">
                      <p className="font-mono text-gray-900">Token: {p.qrToken}</p>
                      <p>Status: <span className={p.status === 'APPROVED' ? 'text-green-400' : p.status === 'PENDING' ? 'text-yellow-400' : ''}>{p.status.replace(/_/g, ' ')}</span></p>
                      {p.approvedAt && <p>Approved: {new Date(p.approvedAt).toLocaleString()}</p>}
                      <p>Created: {new Date(p.createdAt).toLocaleString()}</p>
                      {p.expiresAt && <p>Expires: {new Date(p.expiresAt).toLocaleString()}</p>}
                    </div>
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
