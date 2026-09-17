'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { VendorStatusUpdate, VendorTicketView } from '@apartment/shared';
import { ApiError, API_BASE, vendorPortal } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Public vendor ticket page (no login).
//
// The token in the emailed link is the sole credential, and the backend only
// ever exposes the single ticket that token was issued for - so this page shows
// job details only (never resident contact info or anything financial).
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const ACTION_LABELS: Record<VendorStatusUpdate, string> = {
  IN_PROGRESS: 'Start work',
  RESOLVED: 'Mark as resolved',
};

export default function VendorTicketPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [ticket, setTicket] = useState<VendorTicketView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<VendorStatusUpdate | null>(null);
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setTicket(await vendorPortal.getTicket(token));
      setError('');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'We could not load this ticket. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (status: VendorStatusUpdate) => {
    if (!ticket) return;
    setUpdating(status);
    setNotice('');
    setError('');
    try {
      const updated = await vendorPortal.updateStatus(token, status);
      setTicket(updated);
      setConfirming(false);
      setNotice(
        status === 'RESOLVED'
          ? 'Thanks - this job is marked resolved. The society will review and close the ticket.'
          : 'Marked as in progress.'
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the status. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-2.5">
          <img src="/logo3.png" alt="OmniHome" className="h-8 w-auto object-contain flex-shrink-0" />
          <span className="text-title-sm font-display text-gray-900 whitespace-nowrap">
            Omni<span className="text-accent-600">Home</span>
          </span>
          <span className="ml-auto text-xs text-gray-500">Vendor job link</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {error && !ticket && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center">
            <h1 className="text-lg font-semibold mb-2">This link isn&apos;t usable</h1>
            <p className="text-body-sm text-gray-600">{error}</p>
            <p className="text-caption text-gray-500 mt-4">
              Please contact your point of contact at the society if you think this is a mistake.
            </p>
          </div>
        )}

        {ticket && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-caption text-gray-500">{ticket.societyName}</p>
                <h1 className="text-lg font-semibold">{ticket.ticketRef}</h1>
              </div>
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full border ${
                  STATUS_STYLES[ticket.status] || 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {STATUS_LABELS[ticket.status] || ticket.status}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body-sm mb-5">
              <div>
                <dt className="text-caption text-gray-500">Unit</dt>
                <dd className="text-gray-900">{ticket.unitNumber || 'Not specified'}</dd>
              </div>
              <div>
                <dt className="text-caption text-gray-500">Category</dt>
                <dd className="text-gray-900 capitalize">{ticket.category}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-caption text-gray-500">Assigned to</dt>
                <dd className="text-gray-900">{ticket.vendorName || 'You'}</dd>
              </div>
            </dl>

            <h2 className="text-body-sm font-semibold mb-1">{ticket.title}</h2>
            <p className="text-body-sm text-gray-700 whitespace-pre-wrap mb-5">{ticket.description}</p>

            {ticket.photos.length > 0 && (
              <div className="mb-6">
                <h3 className="text-body-sm font-semibold mb-2">Photos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ticket.photos.map((path, i) => (
                    <a
                      key={i}
                      href={`${API_BASE}${path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-video rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${API_BASE}${path}`}
                        alt={`Ticket photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {notice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-body-sm rounded-lg px-4 py-3 mb-4">
                {notice}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-body-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            {ticket.allowedTransitions.length > 0 ? (
              <div className="border-t border-gray-200 pt-5">
                <p className="text-caption text-gray-500 mb-3">Update the job status</p>
                <div className="flex flex-wrap gap-2">
                  {ticket.allowedTransitions.map((status) =>
                    status === 'RESOLVED' && !confirming ? (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-body-sm font-medium transition-colors"
                      >
                        {ACTION_LABELS[status]}
                      </button>
                    ) : (
                      <button
                        key={status}
                        type="button"
                        disabled={updating !== null}
                        onClick={() => updateStatus(status)}
                        className={`rounded-lg px-4 py-2.5 text-body-sm font-medium transition-colors disabled:opacity-50 ${
                          status === 'RESOLVED'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-accent-600 hover:bg-accent-700 text-white'
                        }`}
                      >
                        {updating === status
                          ? 'Saving…'
                          : status === 'RESOLVED' && confirming
                            ? 'Confirm - job is complete'
                            : ACTION_LABELS[status]}
                      </button>
                    )
                  )}
                  {confirming && (
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="text-body-sm text-gray-600 hover:text-gray-900 px-3 py-2.5"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {confirming && (
                  <p className="text-caption text-gray-500 mt-2">
                    This tells the society the work is done so they can close the ticket.
                  </p>
                )}
              </div>
            ) : (
              <div className="border-t border-gray-200 pt-5">
                <p className="text-body-sm text-gray-600">
                  {ticket.status === 'RESOLVED'
                    ? 'This job is marked resolved - no further action is needed from you.'
                    : 'There are no status updates available for this ticket right now.'}
                </p>
              </div>
            )}

            <p className="text-caption text-gray-400 mt-6">
              This link is personal to you. Please don&apos;t forward it - anyone with the link can
              update this ticket.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
