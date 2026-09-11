'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Mail, Home, Building2, Ticket, FileText, Calendar, Phone } from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';

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

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ISSUED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  DISPUTED: 'bg-yellow-100 text-yellow-800',
};

const ROLE_COLORS: Record<string, string> = {
  COMMITTEE_ADMIN: 'bg-accent-100 text-accent-700',
  RESIDENT: 'bg-green-100 text-green-700',
  SECURITY_GUARD: 'bg-blue-100 text-blue-700',
  VENDOR: 'bg-yellow-100 text-yellow-700',
};

interface ResidentDetail {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  role: string;
  membershipId: string;
  unit: {
    id: string;
    unitNumber: string;
    floor: number;
    bedroomType: string | null;
    buildingId: string;
    buildingName: string;
  } | null;
  recentTickets: {
    id: string;
    title: string;
    status: string;
    category: string;
    createdAt: string;
  }[];
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    title: string;
    amount: number;
    status: string;
    dueDate: string;
    createdAt: string;
  }[];
  ticketStats: {
    status: string;
    count: number;
  }[];
}

export default function ResidentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [resident, setResident] = useState<ResidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    auth.me().catch(() => router.push('/login'));
    fetchResident();
  }, [router, userId]);

  const fetchResident = async () => {
    try {
      const data = await apiGet<ResidentDetail>(`/api/v1/directory/${userId}`);
      setResident(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load resident');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return `Rs ${(amount / 100).toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !resident) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/dashboard/admin/directory')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Error</h1>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">{error || 'Resident not found'}</div>
        </div>
      </div>
    );
  }

  // Calculate ticket counts
  const totalTickets = resident.ticketStats.reduce((sum, s) => sum + s.count, 0);
  const openTickets = resident.ticketStats.find(s => s.status === 'OPEN')?.count || 0;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin/directory')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-50 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-accent-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{resident.name}</h1>
              <p className="text-gray-700 text-sm">{resident.email}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold">{totalTickets}</p>
            <p className="text-xs text-gray-700">Total Tickets</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold text-yellow-600">{openTickets}</p>
            <p className="text-xs text-gray-700">Open Tickets</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold">{resident.recentInvoices.length}</p>
            <p className="text-xs text-gray-700">Recent Invoices</p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
              <p className="text-sm font-medium mt-1">{resident.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
              <p className="text-sm font-medium mt-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-gray-400" /> {resident.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Role</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${ROLE_COLORS[resident.role] || 'bg-gray-100 text-gray-800'}`}>
                {resident.role === 'COMMITTEE_ADMIN' ? 'Committee Admin' : resident.role === 'RESIDENT' ? 'Resident' : resident.role}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Joined</p>
              <p className="text-sm font-medium mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" /> {new Date(resident.joinedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Unit Info */}
        {resident.unit && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Unit Information</h2>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-accent-50 rounded-xl flex items-center justify-center">
                <Home className="w-6 h-6 text-accent-500" />
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Unit Number</p>
                    <p className="text-sm font-medium mt-1">{resident.unit.unitNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Building</p>
                    <p className="text-sm font-medium mt-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      <button
                        onClick={() => router.push(`/dashboard/admin/buildings/${resident.unit!.buildingId}`)}
                        className="hover:text-accent-500 transition-colors"
                      >
                        {resident.unit.buildingName}
                      </button>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Floor</p>
                    <p className="text-sm font-medium mt-1">{resident.unit.floor}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Bedroom Type</p>
                    <p className="text-sm font-medium mt-1">
                      {resident.unit.bedroomType ? (BEDROOM_TYPES[resident.unit.bedroomType] || resident.unit.bedroomType) : 'Not specified'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/admin/units/${resident.unit!.id}`)}
                  className="mt-4 text-sm text-accent-500 hover:text-accent-600 font-medium flex items-center gap-1"
                >
                  View Unit Details →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Unit */}
        {!resident.unit && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Unit Information</h2>
            <div className="text-center py-4">
              <Home className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No unit assigned</p>
            </div>
          </div>
        )}

        {/* Recent Tickets */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Recent Tickets</h2>
          {resident.recentTickets.length === 0 ? (
            <div className="text-center py-4">
              <Ticket className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No tickets yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resident.recentTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">{ticket.title}</p>
                      <p className="text-xs text-gray-500">
                        {ticket.category} · {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        {resident.unit && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Invoices</h2>
            {resident.recentInvoices.length === 0 ? (
              <div className="text-center py-4">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No invoices yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {resident.recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">{invoice.title}</p>
                        <p className="text-xs text-gray-500">
                          {invoice.invoiceNumber} · Due {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatAmount(invoice.amount)}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status] || 'bg-gray-100 text-gray-800'}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
