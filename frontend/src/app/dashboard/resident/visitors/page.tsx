'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, QrCode, X, Clock, User, Phone, Car } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { VisitorPassResponse } from '@apartment/shared';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  APPROVED: 'bg-blue-500/10 text-blue-400',
  CHECKED_IN: 'bg-green-500/10 text-green-400',
  CHECKED_OUT: 'bg-gray-500/10 text-gray-700',
  EXPIRED: 'bg-red-500/10 text-red-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

export default function ResidentVisitorsPage() {
  const router = useRouter();
  const [passes, setPasses] = useState<VisitorPassResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showQr, setShowQr] = useState<string | null>(null);

  const fetchPasses = useCallback(async () => {
    try {
      const data = await apiGet<VisitorPassResponse[]>('/api/v1/visitors');
      setPasses(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  const resetForm = () => {
    setVisitorName(''); setVisitorPhone(''); setVisitorEmail('');
    setVehicleNumber(''); setPurpose(''); setShowForm(false); setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const body: any = { visitorName, visitorPhone };
      if (visitorEmail) body.visitorEmail = visitorEmail;
      if (vehicleNumber) body.vehicleNumber = vehicleNumber;
      if (purpose) body.purpose = purpose;
      await apiPost('/api/v1/visitors', body);
      resetForm();
      setSuccess('Visitor pass created! Share the QR code with your visitor.');
      fetchPasses();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (id: string) => {
    try {
      await apiPost(`/api/v1/visitors/${id}/cancel`);
      fetchPasses();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center "><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>;

  const activePasses = passes.filter((p) => ['PENDING', 'APPROVED', 'CHECKED_IN'].includes(p.status));
  const historyPasses = passes.filter((p) => ['CHECKED_OUT', 'EXPIRED', 'CANCELLED'].includes(p.status));

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/resident')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
            <div><h1 className="text-2xl font-bold text-gray-900">Visitor Passes</h1><p className="text-gray-700 text-sm">Pre-approve visitors for gate access</p></div>
          </div>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Plus className="w-4 h-4" /> New Pass</button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* Create Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold mb-4">Create Visitor Pass</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name *</label>
                <input type="text" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="e.g. John Doe" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input type="tel" value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} placeholder="e.g. +1 555-1234" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                <input type="email" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} placeholder="visitor@email.com" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number (optional)</label>
                <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. ABC 1234" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose (optional)</label>
                <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Delivery, Family visit, Maintenance" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition-all">{submitting ? 'Creating...' : 'Create Pass'}</button>
                <button type="button" onClick={resetForm} className="text-sm text-gray-700 hover:text-gray-900 px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Active Passes */}
        <h2 className="text-lg font-semibold mb-4">Active Passes</h2>
        {activePasses.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 border border-gray-200 text-center mb-8">
            <QrCode className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-700 text-sm">No active visitor passes</p>
            <p className="text-gray-700 text-xs mt-1">Create a pass for your visitors to get gate access</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {activePasses.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] || ''}`}>{p.status}</span>
                      <span className="text-xs text-gray-700 font-medium">{p.visitorName}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-700 mt-1">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {p.visitorPhone}</span>
                      {p.vehicleNumber && <span className="flex items-center gap-1"><Car className="w-3 h-3" /> {p.vehicleNumber}</span>}
                      {p.purpose && <span className="flex items-center gap-1">{p.purpose}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={() => setShowQr(showQr === p.id ? null : p.id)} className={`p-2 rounded-lg transition-all ${showQr === p.id ? 'bg-cyan-500/20 text-accent-500' : 'hover:bg-gray-50 text-gray-700'}`} title="Show QR code"><QrCode className="w-4 h-4" /></button>
                    {['PENDING', 'APPROVED'].includes(p.status) && (
                      <button onClick={() => handleCancel(p.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 hover:bg-red-500/10 rounded-lg transition-colors">Cancel</button>
                    )}
                  </div>
                </div>

                {showQr === p.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col items-center">
                    <div className="bg-white p-3 rounded-xl mb-3">
                      <QRCodeSVG value={p.qrToken} size={160} level="M" includeMargin />
                    </div>
                    <p className="text-[10px] text-gray-700 font-mono mb-1">Token: {p.qrToken}</p>
                    <p className="text-[10px] text-gray-700">Show this QR code at the gate for entry</p>
                    <p className="text-[10px] text-gray-700 mt-1">Created: {new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {historyPasses.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-4">History</h2>
            <div className="space-y-2">
              {historyPasses.map((p) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 border border-gray-200 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] || ''}`}>{p.status}</span>
                    <span className="text-xs text-gray-700">{p.visitorName}</span>
                    <span className="text-[10px] text-gray-700 ml-auto">{new Date(p.createdAt).toLocaleDateString()}</span>
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
