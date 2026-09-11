'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, AlertTriangle, Shield, CheckCircle, Clock,
  Phone, User, Building2, Search, Filter,
} from 'lucide-react';
import { ApiError, apiGet, apiPatch } from '@/lib/api';
import type { SOSAlertResponse, SOSAlertCategory, SOSAlertStatus } from '@apartment/shared';

const CATEGORY_LABELS: Record<SOSAlertCategory, string> = {
  MEDICAL: 'Medical',
  FIRE: 'Fire',
  SECURITY: 'Security',
  OTHER: 'Other',
};

const CATEGORY_COLORS: Record<SOSAlertCategory, string> = {
  MEDICAL: 'bg-blue-500/10 text-blue-600',
  FIRE: 'bg-orange-500/10 text-orange-600',
  SECURITY: 'bg-purple-500/10 text-purple-600',
  OTHER: 'bg-gray-500/10 text-gray-600',
};

const STATUS_COLORS: Record<SOSAlertStatus, string> = {
  ACTIVE: 'bg-red-500/10 text-red-600',
  ACKNOWLEDGED: 'bg-yellow-500/10 text-yellow-600',
  RESOLVED: 'bg-green-500/10 text-green-600',
};

const CATEGORY_EMOJIS: Record<SOSAlertCategory, string> = {
  MEDICAL: '🏥',
  FIRE: '🔥',
  SECURITY: '🛡️',
  OTHER: '⚠️',
};

export default function AdminSOSAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<SOSAlertResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'ALL' | SOSAlertStatus>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<SOSAlertResponse | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : '';
      const data = await apiGet<SOSAlertResponse[]>(`/api/v1/sos-alerts${params}`);
      setAlerts(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router, filter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (id: string) => {
    setError(''); setSuccess('');
    try {
      await apiPatch(`/api/v1/sos-alerts/${id}`, { status: 'ACKNOWLEDGED' });
      setSuccess('Alert acknowledged');
      fetchAlerts();
      if (selectedAlert?.id === id) {
        setSelectedAlert({ ...selectedAlert, status: 'ACKNOWLEDGED' });
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleResolve = async (id: string) => {
    setError(''); setSuccess('');
    setSubmitting(true);
    try {
      await apiPatch(`/api/v1/sos-alerts/${id}`, {
        status: 'RESOLVED',
        notes: resolveNotes.trim() || undefined,
      });
      setSuccess('Alert resolved');
      setResolveNotes('');
      setSelectedAlert(null);
      fetchAlerts();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              SOS Emergency Alerts
            </h1>
            <p className="text-gray-700 text-sm">Monitor and respond to emergency alerts from residents</p>
          </div>
          {activeAlerts.length > 0 && (
            <span className="bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-full animate-pulse">
              {activeAlerts.length} Active
            </span>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* Filter */}
        <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5 mb-6 w-fit">
          {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                filter === f ? 'bg-accent-600 text-white' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Alert Detail Modal */}
        {selectedAlert && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedAlert(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[selectedAlert.category]}`}>
                  <span className="text-2xl">{CATEGORY_EMOJIS[selectedAlert.category]}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">{CATEGORY_LABELS[selectedAlert.category]} Emergency</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedAlert.status]}`}>
                    {selectedAlert.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4" /> <strong>{selectedAlert.residentName}</strong>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Building2 className="w-4 h-4" /> Unit {selectedAlert.unitNumber}
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-4 h-4" /> {new Date(selectedAlert.createdAt).toLocaleString()}
                </div>
                {selectedAlert.resolvedByName && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" /> Resolved by {selectedAlert.resolvedByName}
                  </div>
                )}
                {selectedAlert.notes && (
                  <div className="bg-gray-50 rounded-lg p-3 text-gray-700">{selectedAlert.notes}</div>
                )}
              </div>

              {selectedAlert.status === 'ACTIVE' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAcknowledge(selectedAlert.id)}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2.5 rounded-xl text-sm transition-all"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleResolve(selectedAlert.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-xl text-sm transition-all"
                  >
                    Resolve
                  </button>
                </div>
              )}

              {selectedAlert.status === 'ACKNOWLEDGED' && (
                <div className="space-y-3">
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="Add resolution notes (optional)..."
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-500/50"
                  />
                  <button
                    onClick={() => handleResolve(selectedAlert.id)}
                    disabled={submitting}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-all"
                  >
                    {submitting ? 'Resolving...' : 'Mark as Resolved'}
                  </button>
                </div>
              )}

              <button
                onClick={() => setSelectedAlert(null)}
                className="w-full mt-3 text-sm text-gray-700 hover:text-gray-900 py-2"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div className="text-center py-20">
            <Shield className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">No SOS alerts</p>
            <p className="text-gray-700 text-sm mt-1">All clear — no emergency alerts have been triggered</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`w-full text-left bg-white border rounded-xl shadow-sm p-4 transition-all hover:shadow-md ${
                  alert.status === 'ACTIVE'
                    ? 'border-l-4 border-l-red-500 border-gray-200 hover:border-red-300'
                    : alert.status === 'ACKNOWLEDGED'
                    ? 'border-l-4 border-l-yellow-500 border-gray-200 hover:border-yellow-300'
                    : 'border-gray-200 hover:border-gray-300 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${CATEGORY_COLORS[alert.category]}`}>
                    <span className="text-lg">{CATEGORY_EMOJIS[alert.category]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{alert.residentName}</span>
                      <span className="text-xs text-gray-700">·</span>
                      <span className="text-xs text-gray-700">Unit {alert.unitNumber}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[alert.status]}`}>
                        {alert.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-700">
                      <span className={`font-medium ${CATEGORY_COLORS[alert.category]}`}>
                        {CATEGORY_LABELS[alert.category]}
                      </span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                      {alert.resolvedByName && (
                        <span className="text-green-600">Resolved by {alert.resolvedByName}</span>
                      )}
                    </div>
                  </div>
                  {alert.status === 'ACTIVE' && (
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse flex-shrink-0 mt-1" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
