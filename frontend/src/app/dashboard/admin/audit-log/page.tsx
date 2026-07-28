'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Clock, Download } from 'lucide-react';
import { ApiError, apiGet } from '@/lib/api';
import type { AuditLogResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Color mapping for audit log action types (matched to tickets pattern)
const ACTION_COLORS: Record<string, string> = {
  SOCIETY: 'bg-blue-500/10 text-blue-400',
  NOTICE: 'bg-amber-500/10 text-amber-400',
  TICKET: 'bg-purple-500/10 text-purple-400',
  BOOKING: 'bg-indigo-500/10 text-indigo-400',
  VOTE: 'bg-green-500/10 text-green-400',
  INVOICE: 'bg-emerald-500/10 text-emerald-400',
  VISITOR: 'bg-cyan-500/10 text-cyan-400',
  DOCUMENT: 'bg-orange-500/10 text-orange-400',
  MEMBERSHIP: 'bg-pink-500/10 text-pink-400',
  POLL: 'bg-rose-500/10 text-rose-400',
};

function getActionColor(action: string): string {
  // Actions are like "POLL_CLOSED", "INVOICE_CREATED" — extract entity prefix before first underscore
  const entityType = action.split('_')[0];
  return ACTION_COLORS[entityType] || 'bg-gray-500/10 text-gray-700';
}

export default function AdminAuditLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      const data = await apiGet<{ logs: AuditLogResponse[]; total: number; page: number; totalPages: number }>(
        `/api/v1/audit-logs?${params.toString()}`
      );
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router, page, search, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const exportUrl = `${API_BASE}/api/v1/audit-logs/export`;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
            <div><h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1><p className="text-gray-700 text-sm">Searchable history of all actions ({total} records)</p></div>
          </div>
          <a
            href={exportUrl}
            target="_blank"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Download className="w-4 h-4" /> Export
          </a>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200 mb-6">
          <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actions, entities..." className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
            </div>
            <div className="w-48">
              <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50">
                <option value="">All Actions</option>
                <option value="SOCIETY">Society</option>
                <option value="NOTICE">Notice</option>
                <option value="TICKET">Ticket</option>
                <option value="BOOKING">Booking</option>
                <option value="VOTE">Vote</option>
                <option value="INVOICE">Invoice</option>
                <option value="VISITOR">Visitor</option>
                <option value="DOCUMENT">Document</option>
                <option value="MEMBERSHIP">Membership</option>
                <option value="POLL">Poll</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"><Search className="w-4 h-4 inline mr-1" />Search</button>
              <button type="button" onClick={() => { setSearch(''); setActionFilter(''); setPage(1); }} className="text-sm text-gray-700 hover:text-white px-3 py-2">Clear</button>
            </div>
          </form>
        </div>

        {/* Log List */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20"><Clock className="w-12 h-12 text-gray-700 mx-auto mb-4" /><p className="text-gray-700">No audit log entries found</p></div>
        ) : (
          <>
            <div className="space-y-2 mb-6">
              {logs.map((l) => (
                <div key={l.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${getActionColor(l.action)}`}>{l.action}</span>
                        <span className="text-xs text-gray-700">{l.entityType} · {l.entityId.slice(0, 8)}</span>
                      </div>
                      <p className="text-xs text-gray-700">
                        <span className="text-gray-700">By:</span> {l.actorName || 'System'}
                      </p>
                      {l.afterJson && Object.keys(l.afterJson).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-gray-700 cursor-pointer hover:text-gray-700">View details</summary>
                          <pre className="text-xs text-gray-700 mt-1 bg-gray-50 rounded p-2 overflow-x-auto">{JSON.stringify(l.afterJson, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                    <div className="text-xs text-gray-700 ml-3 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg bg-gray-50 hover:bg-white/10 disabled:opacity-30 transition-all">Previous</button>
              <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-sm rounded-lg bg-gray-50 hover:bg-white/10 disabled:opacity-30 transition-all">Next</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
