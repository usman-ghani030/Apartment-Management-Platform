'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Search, CheckCircle, XCircle, LogOut, Clock, User, Phone, Car } from 'lucide-react';
import { auth, ApiError, apiPost } from '@/lib/api';
import type { AuthResponse, VisitorPassResponse } from '@apartment/shared';

export default function GuardDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authData, setAuthData] = useState<AuthResponse | null>(null);
  const [qrToken, setQrToken] = useState('');
  const [pass, setPass] = useState<VisitorPassResponse | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<'scan' | 'recent'>('scan');

  useEffect(() => {
    auth.me()
      .then((data) => {
        const isGuard = data.memberships.some((m) =>
          m.role === 'SECURITY_GUARD' || m.role === 'COMMITTEE_ADMIN' || m.role === 'SUPER_ADMIN'
        );
        if (!isGuard) { router.push('/login'); return; }
        setAuthData(data);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleVerify = async () => {
    if (!qrToken.trim()) return;
    setVerifying(true); setVerifyError(''); setVerifySuccess(''); setPass(null); setActionMsg('');

    try {
      const data = await apiPost<VisitorPassResponse>(`/api/v1/visitors/verify/${qrToken.trim()}`);
      setPass(data);
      setVerifySuccess(`Visitor: ${data.visitorName} (Unit ${data.unitNumber})`);
    } catch (err) {
      if (err instanceof ApiError) {
        setVerifyError(err.message);
      } else {
        setVerifyError('Failed to verify QR code');
      }
    } finally { setVerifying(false); }
  };

  const handleGateAction = async (action: 'ENTRY' | 'EXIT') => {
    if (!pass) return;
    setRecording(true); setActionMsg('');

    try {
      await apiPost(`/api/v1/visitors/${pass.id}/gate`, { action });
      setActionMsg(action === 'ENTRY' ? '✓ Check-in recorded' : '✓ Check-out recorded');
      setPass(null);
      setQrToken('');
    } catch (err) {
      if (err instanceof ApiError) setActionMsg(`Error: ${err.message}`);
      else setActionMsg('Failed to record');
    } finally { setRecording(false); }
  };

  const handleLogout = async () => {
    await auth.logout();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-body-sm text-gray-700">Loading security gate...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-body-sm font-semibold text-gray-900">Security Gate</p>
              <p className="text-caption-xs text-gray-700">{authData?.memberships[0]?.societyName || 'Dashboard'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-caption text-gray-700">{authData?.user.name}</span>
            <button onClick={handleLogout} className="p-2 rounded-lg transition-colors text-gray-700 hover:text-status-danger hover:bg-gray-50">
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Mode Toggle */}
        <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5 mb-6 border border-gray-200">
          <button
            onClick={() => setMode('scan')}
            className={`flex-1 text-body-sm px-4 py-2.5 rounded-md transition-all font-medium ${
              mode === 'scan'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            <Search className="w-4 h-4 inline mr-1.5" />Scan QR
          </button>
          <button
            onClick={() => { setMode('recent'); setPass(null); }}
            className={`flex-1 text-body-sm px-4 py-2.5 rounded-md transition-all font-medium ${
              mode === 'recent'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1.5" />Recent Activity
          </button>
        </div>

        {mode === 'scan' && (
          <>
            {/* QR Code Input */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-title-sm mb-4">Verify visitor pass</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="Scan QR code or enter token manually"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-body-sm text-gray-900 placeholder-neutral-500 focus:outline-none focus:border-accent-500/50"
                  autoFocus
                />
                <button
                  onClick={handleVerify}
                  disabled={verifying || !qrToken.trim()}
                  className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-6 py-3 text-body-sm font-medium transition-all whitespace-nowrap"
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>

            {/* Status Messages */}
            {verifyError && (
              <div className="bg-status-danger/10 border border-status-danger/20 text-status-danger text-body-sm rounded-xl px-5 py-4 mb-4 flex items-center gap-3">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}
            {actionMsg && (
              <div className={`text-body-sm rounded-xl px-5 py-4 mb-4 flex items-center gap-3 ${
                actionMsg.startsWith('✓')
                  ? 'bg-status-success/10 border border-status-success/20 text-status-success'
                  : 'bg-status-danger/10 border border-status-danger/20 text-status-danger'
              }`}>
                <span>{actionMsg}</span>
              </div>
            )}

            {/* Visitor Details Card */}
            {pass && (
              <div className="bg-white border-2 border-accent-500/30 rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 bg-accent-50 rounded-full flex items-center justify-center">
                    <User className="w-7 h-7 text-accent-600" />
                  </div>
                  <div>
                    <h3 className="text-display-sm">{pass.visitorName}</h3>
                    <span className={`text-caption-xs font-medium px-2 py-0.5 rounded-full ${
                      pass.status === 'APPROVED' ? 'bg-status-info/10 text-status-info' :
                      pass.status === 'CHECKED_IN' ? 'bg-status-success/10 text-status-success' :
                      pass.status === 'PENDING' ? 'bg-status-warning/10 text-status-warning' :
                      'bg-gray-100 text-gray-700'
                    }`}>{pass.status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-body-sm mb-5">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-caption-xs text-gray-700 uppercase tracking-wider mb-1">Unit</p>
                    <p className="font-medium text-gray-900">{pass.unitNumber}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-caption-xs text-gray-700 uppercase tracking-wider mb-1">Resident</p>
                    <p className="font-medium text-gray-900">{pass.residentName}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-caption-xs text-gray-700 uppercase tracking-wider mb-1">Phone</p>
                    <p className="font-medium text-gray-900">{pass.visitorPhone}</p>
                  </div>
                  {pass.vehicleNumber && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-caption-xs text-gray-700 uppercase tracking-wider mb-1">Vehicle</p>
                      <p className="font-medium text-gray-900">{pass.vehicleNumber}</p>
                    </div>
                  )}
                </div>

                {pass.purpose && (
                  <div className="bg-gray-50 rounded-lg p-3 text-body-sm mb-5">
                    <p className="text-caption-xs text-gray-700 uppercase tracking-wider mb-1">Purpose</p>
                    <p className="text-gray-900">{pass.purpose}</p>
                  </div>
                )}

                {/* Gate Action Buttons - large touch targets */}
                <div className="flex gap-3">
                  {(pass.status === 'APPROVED' || pass.status === 'PENDING') && (
                    <button
                      onClick={() => handleGateAction('ENTRY')}
                      disabled={recording}
                      className="flex-1 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-xl py-5 text-body font-semibold transition-all flex items-center justify-center gap-2 min-h-[56px]"
                    >
                      <CheckCircle className="w-6 h-6" />
                      {recording ? 'Recording...' : 'Check In'}
                    </button>
                  )}
                  {pass.status === 'CHECKED_IN' && (
                    <button
                      onClick={() => handleGateAction('EXIT')}
                      disabled={recording}
                      className="flex-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white rounded-xl py-5 text-body font-semibold transition-all flex items-center justify-center gap-2 min-h-[56px]"
                    >
                      <LogOut className="w-6 h-6" />
                      {recording ? 'Recording...' : 'Check Out'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick instructions */}
            <p className="text-center text-caption text-gray-700">
              Scan the visitor&apos;s QR code or type the token above
            </p>
          </>
        )}

        {mode === 'recent' && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
            <Clock className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-body-sm text-gray-700">Recent gate activity will appear here</p>
          </div>
        )}
      </main>
    </div>
  );
}
