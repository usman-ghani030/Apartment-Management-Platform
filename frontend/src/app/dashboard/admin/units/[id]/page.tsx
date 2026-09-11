'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Home, Building2, User, Mail, Phone, Ticket, ExternalLink, ArrowRightLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { auth, ApiError, apiGet, apiPost } from '@/lib/api';

const UNIT_TYPES: Record<string, string> = {
  OWNER_OCCUPIED: 'Owner Occupied',
  RENTED: 'Rented',
  VACANT: 'Vacant',
};

const BEDROOM_TYPES: Record<string, string> = {
  STUDIO: 'Studio',
  ONE_BED: '1 Bedroom',
  TWO_BED: '2 Bedrooms',
  THREE_BED: '3 Bedrooms',
  FOUR_BED: '4 Bedrooms',
  FOUR_PLUS_BED: '4+ Bedrooms',
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

interface UnitDetail {
  id: string;
  unitNumber: string;
  floor: number;
  type: string;
  bedroomType: string | null;
  buildingId: string;
  buildingName: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  hasLinkedResident: boolean;
  members: UnitMember[];
  recentTickets: UnitTicket[];
  createdAt: string;
  updatedAt: string;
}

interface UnitMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface UnitTicket {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export default function UnitDetailPage() {
  const router = useRouter();
  const params = useParams();
  const unitId = params.id as string;

  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferCheck, setTransferCheck] = useState<any>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [completingTransfer, setCompletingTransfer] = useState(false);

  useEffect(() => {
    auth.me().catch(() => router.push('/login'));
    fetchUnit();
  }, [router, unitId]);

  const fetchUnit = async () => {
    try {
      const data = await apiGet<UnitDetail>(`/api/v1/units/${unitId}`);
      setUnit(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load unit');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTransfer = async () => {
    setError(''); setSuccess('');
    setTransferLoading(true);
    setShowTransfer(true);
    try {
      const data = await apiGet<any>(`/api/v1/units/${unitId}/transfer-check`);
      setTransferCheck(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      setShowTransfer(false);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCompleteTransfer = async () => {
    setCompletingTransfer(true);
    setError('');
    try {
      const result = await apiPost<any>(`/api/v1/units/${unitId}/complete-transfer`, {});
      setSuccess(`Transfer completed — ${result.deactivatedMembers} member(s) deactivated, primary contact cleared`);
      setShowTransfer(false);
      setTransferCheck(null);
      fetchUnit();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setCompletingTransfer(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !unit) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/dashboard/admin/units')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Error</h1>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">{error || 'Unit not found'}</div>
        </div>
      </div>
    );
  }

  const hasOccupants = unit!.hasLinkedResident || !!unit!.primaryContactName;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin/units')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-accent-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Unit {unit!.unitNumber}</h1>
              <p className="text-gray-700 text-sm mt-1">
                <button onClick={() => router.push(`/dashboard/admin/buildings/${unit!.buildingId}`)} className="hover:text-accent-500 transition-colors">
                  {unit!.buildingName}
                </button>
                {' · Floor '}{unit!.floor}
              </p>
            </div>
          </div>
          {hasOccupants && (
            <button
              onClick={handleOpenTransfer}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            >
              <ArrowRightLeft className="w-4 h-4" /> Transfer / Move-Out
            </button>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

        {/* Transfer Clearance Modal */}
        {showTransfer && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setShowTransfer(false); setTransferCheck(null); }}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Transfer Clearance</h3>
                  <p className="text-sm text-gray-700">Unit {unit!.unitNumber} · {unit!.buildingName}</p>
                </div>
              </div>

              {transferLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-accent-500 border-t-transparent rounded-full" />
                </div>
              ) : transferCheck ? (
                <div className="space-y-4">
                  {/* Outstanding Invoices */}
                  {transferCheck.unpaidCount > 0 ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h4 className="font-semibold text-red-700">{transferCheck.unpaidCount} Unpaid Invoice{transferCheck.unpaidCount > 1 ? 's' : ''}</h4>
                      </div>
                      <p className="text-sm text-red-600 mb-3">
                        All dues must be settled before transfer. Total outstanding: <strong>Rs {(transferCheck.unpaidTotal / 100).toLocaleString()}</strong>
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {transferCheck.unpaidInvoices.map((inv: any) => (
                          <div key={inv.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100">
                            <div>
                              <p className="text-sm font-medium">{inv.title}</p>
                              <p className="text-xs text-gray-500">{inv.invoiceNumber} · Due {new Date(inv.dueDate).toLocaleDateString()}</p>
                            </div>
                            <span className="text-sm font-semibold text-red-600">Rs {(inv.amount / 100).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <button
                          onClick={() => router.push('/dashboard/admin/invoices')}
                          className="w-full text-sm text-red-600 font-medium hover:text-red-700"
                        >
                          Go to Invoices →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h4 className="font-semibold text-green-700">All Dues Settled</h4>
                      </div>
                      <p className="text-sm text-green-600">No outstanding invoices. Transfer can proceed.</p>
                    </div>
                  )}

                  {/* Members to deactivate */}
                  {transferCheck.activeMembers.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {transferCheck.activeMembers.length} active member{transferCheck.activeMembers.length > 1 ? 's' : ''} will be deactivated:
                      </p>
                      <div className="space-y-1">
                        {transferCheck.activeMembers.map((m: any) => (
                          <div key={m.membershipId} className="flex items-center gap-2 text-sm text-gray-700">
                            <User className="w-3 h-3" /> {m.name} <span className="text-xs text-gray-500">({m.role})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Primary contact */}
                  {transferCheck.primaryContactName && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Primary contact will be cleared:</p>
                      <p className="text-sm text-gray-700">{transferCheck.primaryContactName} {transferCheck.primaryContactEmail ? `(${transferCheck.primaryContactEmail})` : ''}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => { setShowTransfer(false); setTransferCheck(null); }}
                      className="flex-1 px-4 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCompleteTransfer}
                      disabled={!transferCheck.canTransfer || completingTransfer}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        transferCheck.canTransfer
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {completingTransfer ? 'Completing...' : transferCheck.canTransfer ? 'Complete Transfer' : 'Settle Dues First'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Unit Info Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Unit Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Type</p>
              <p className="text-sm font-medium mt-1">{UNIT_TYPES[unit!.type] || unit!.type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Bedroom Type</p>
              <p className="text-sm font-medium mt-1">{unit!.bedroomType ? (BEDROOM_TYPES[unit!.bedroomType] || unit!.bedroomType) : 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Floor</p>
              <p className="text-sm font-medium mt-1">{unit!.floor}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Building</p>
              <p className="text-sm font-medium mt-1">{unit!.buildingName}</p>
            </div>
          </div>
        </div>

        {/* Occupant Section */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Occupant Information</h2>
          
          {unit!.hasLinkedResident ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Linked to Account
                </span>
              </div>
              {unit!.members.map((member) => (
                <div key={member.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-accent-50 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-accent-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{member.name}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Mail className="w-3 h-3" /> {member.email}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-100 text-accent-700">
                        {member.role}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : unit!.primaryContactName ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  ⚠ Not yet linked to an account
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{unit!.primaryContactName}</p>
                    <div className="flex flex-col gap-1 mt-2">
                      {unit!.primaryContactEmail && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail className="w-3 h-3" /> {unit!.primaryContactEmail}
                        </span>
                      )}
                      {unit!.primaryContactPhone && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="w-3 h-3" /> {unit!.primaryContactPhone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {unit!.primaryContactEmail && (
                <button
                  onClick={() => router.push(`/dashboard/admin/memberships?inviteEmail=${encodeURIComponent(unit!.primaryContactEmail!)}&inviteName=${encodeURIComponent(unit!.primaryContactName || '')}&unitId=${unit!.id}`)}
                  className="w-full flex items-center justify-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg py-2.5 text-sm font-medium transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Invite as Resident
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-gray-500 text-sm">No contact information on file</p>
            </div>
          )}
        </div>

        {/* Recent Tickets */}
        {unit!.recentTickets.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Tickets</h2>
            <div className="space-y-3">
              {unit!.recentTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">{ticket.title}</p>
                      <p className="text-xs text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
