'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Clock, Star, Tags, TrendingUp, BarChart3 } from 'lucide-react';
import { ApiError, apiGet } from '@/lib/api';

// Amounts are stored in paisa (rupees × 100) — format as Pakistani Rupees.
const formatRs = (paisa: number) => `Rs. ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface AnalyticsData {
  duesCollection: { month: string; invoiced: number; collected: number; rate: number | null }[];
  ticketResolution: { closedCount: number; avgHours: number | null; avgDays: number | null };
  ticketVolumeByCategory: { category: string; count: number }[];
  vendorPerformance: { vendorName: string; avgRating: number; ratingCount: number; closedTickets: number }[];
}

const EMPTY: AnalyticsData = {
  duesCollection: [],
  ticketResolution: { closedCount: 0, avgHours: null, avgDays: null },
  ticketVolumeByCategory: [],
  vendorPerformance: [],
};

function StatTile({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption-xs font-medium text-gray-700">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-accent-50' : 'bg-gray-50'}`}>
          <Icon className={`w-4.5 h-4.5 ${accent ? 'text-accent-600' : 'text-gray-700'}`} />
        </div>
      </div>
      <p className="text-display-sm font-bold text-gray-900 mb-0.5">{value}</p>
      <p className="text-caption-xs text-gray-700">{sub}</p>
    </div>
  );
}

function Stars({ value, className = 'w-4 h-4' }: { value: number; className?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${className} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </span>
  );
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiGet<AnalyticsData>('/api/v1/analytics');
        if (!cancelled) setData(result || EMPTY);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) { router.push('/login'); return; }
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const latest = data.duesCollection[data.duesCollection.length - 1];
  const maxCategoryCount = Math.max(1, ...data.ticketVolumeByCategory.map((c) => c.count));
  const maxRate = Math.max(100, ...data.duesCollection.map((d) => d.rate ?? 0));

  return (
    <div className="px-4 py-6 max-w-7xl">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-display-sm font-bold text-gray-900">Analytics</h1>
            <p className="text-body-sm text-gray-700">Dues collection, ticket health, and vendor performance</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
      )}

      {/* ── Summary tiles ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatTile
          label="Collection rate · this month"
          value={latest?.rate != null ? `${latest.rate}%` : '—'}
          sub={latest ? `${formatRs(latest.collected)} of ${formatRs(latest.invoiced)} invoiced` : 'No invoices this month'}
          icon={Wallet}
          accent
        />
        <StatTile
          label="Avg. resolution time"
          value={data.ticketResolution.avgDays != null ? `${data.ticketResolution.avgDays}d` : '—'}
          sub={data.ticketResolution.closedCount > 0 ? `across ${data.ticketResolution.closedCount} closed ticket${data.ticketResolution.closedCount === 1 ? '' : 's'}` : 'No closed tickets yet'}
          icon={Clock}
        />
        <StatTile
          label="Tickets by category"
          value={`${data.ticketVolumeByCategory.length}`}
          sub={data.ticketVolumeByCategory[0] ? `Most: ${data.ticketVolumeByCategory[0].category} (${data.ticketVolumeByCategory[0].count})` : 'No tickets yet'}
          icon={Tags}
        />
        <StatTile
          label="Rated vendors"
          value={`${data.vendorPerformance.length}`}
          sub={data.vendorPerformance[0] ? `Top: ${data.vendorPerformance[0].vendorName} ★${data.vendorPerformance[0].avgRating.toFixed(1)}` : 'No vendor ratings yet'}
          icon={Star}
        />
      </div>

      {/* ── Dues collection chart ───────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-accent-600" />
          <h2 className="text-title-sm font-semibold text-gray-900">Dues collection over time</h2>
        </div>
        <p className="text-caption text-gray-700 mb-5">Invoiced vs collected per month, with the collection rate on top</p>

        {data.duesCollection.every((d) => d.invoiced === 0 && d.collected === 0) ? (
          <div className="text-center py-10">
            <Wallet className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-body-sm text-gray-700">No invoices or payments recorded yet</p>
            <p className="text-caption text-gray-700 mt-1">Create an invoice to start seeing collection trends</p>
          </div>
        ) : (
          <div className="flex items-end gap-3 sm:gap-5 h-48 px-2">
            {data.duesCollection.map((d) => {
              const height = d.rate != null ? Math.max(6, (d.rate / maxRate) * 100) : 0;
              return (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-caption-xs font-semibold text-gray-900">
                    {d.rate != null ? `${d.rate}%` : '—'}
                  </span>
                  <div className="w-full max-w-12 flex items-end justify-center gap-1 flex-1">
                    {/* invoiced bar */}
                    <div
                      className="w-1/3 rounded-t bg-gray-200"
                      style={{ height: `${d.invoiced > 0 ? Math.max(6, (d.invoiced / Math.max(1, ...data.duesCollection.map((x) => x.invoiced))) * 100) : 2}%` }}
                      title={`Invoiced: ${formatRs(d.invoiced)}`}
                    />
                    {/* collected bar */}
                    <div
                      className="w-1/3 rounded-t bg-accent-600"
                      style={{ height: `${d.collected > 0 ? Math.max(6, (d.collected / Math.max(1, ...data.duesCollection.map((x) => x.collected))) * 100) : 2}%` }}
                      title={`Collected: ${formatRs(d.collected)}`}
                    />
                  </div>
                  <span className="text-caption-xs text-gray-700">{d.month}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 text-caption-xs text-gray-700">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-accent-600 inline-block" /> Collected</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Invoiced</span>
        </div>
      </div>

      {/* ── Category volume + vendor performance ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket volume by category */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Tags className="w-5 h-5 text-accent-600" />
            <h2 className="text-title-sm font-semibold text-gray-900">Tickets by category</h2>
          </div>
          <p className="text-caption text-gray-700 mb-5">All tickets, grouped by what residents reported</p>

          {data.ticketVolumeByCategory.length === 0 ? (
            <p className="text-caption text-gray-700 text-center py-8">No tickets yet — categories appear once residents raise tickets</p>
          ) : (
            <div className="space-y-3">
              {data.ticketVolumeByCategory.map((c) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-body-sm font-medium text-gray-900 capitalize">{c.category}</span>
                    <span className="text-caption-xs text-gray-700">{c.count} ticket{c.count === 1 ? '' : 's'}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-600 transition-all"
                      style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vendor performance */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-accent-600" />
            <h2 className="text-title-sm font-semibold text-gray-900">Vendor performance</h2>
          </div>
          <p className="text-caption text-gray-700 mb-5">Average rating from closed tickets, by vendor</p>

          {data.vendorPerformance.length === 0 ? (
            <p className="text-caption text-gray-700 text-center py-8">No ratings yet — vendors appear here once tickets are closed with a rating</p>
          ) : (
            <div className="space-y-2">
              {data.vendorPerformance.map((v) => (
                <div key={v.vendorName} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-gray-900 truncate">{v.vendorName}</p>
                    <p className="text-caption-xs text-gray-700">
                      {v.ratingCount} rating{v.ratingCount === 1 ? '' : 's'} · {v.closedTickets} closed ticket{v.closedTickets === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex justify-end mb-0.5">
                      <Stars value={v.avgRating} className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-caption-xs font-semibold text-gray-900">{v.avgRating.toFixed(1)} / 5</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
