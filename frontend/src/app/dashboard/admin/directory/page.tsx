'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, Search, Building2, Home, Mail, User as UserIcon,
  ChevronRight, X, UserSearch,
} from 'lucide-react';
import { ApiError, apiGet } from '@/lib/api';

interface DirectoryEntry {
  userId: string;
  name: string;
  email: string;
  unitId: string | null;
  unitNumber: string | null;
  floor: number | null;
  buildingId: string | null;
  buildingName: string | null;
  role: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resident directory - the whole society in one place, grouped by building.
//
// The full list is fetched once and filtered in the browser. Searching must
// never change what the stats count, and the search box must stay on screen
// when a query matches nothing (otherwise the page becomes impossible to
// recover from without a reload).
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; badge: string; chip: string }> = {
  COMMITTEE_ADMIN: {
    label: 'Admin',
    badge: 'bg-purple-50 text-purple-700 ring-purple-200/60',
    chip: 'from-purple-500 to-purple-600 ring-purple-200',
  },
  RESIDENT: {
    label: 'Resident',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
    chip: 'from-emerald-500 to-emerald-600 ring-emerald-200',
  },
  SECURITY_GUARD: {
    label: 'Guard',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200/60',
    chip: 'from-amber-500 to-amber-600 ring-amber-200',
  },
  VENDOR: {
    label: 'Vendor',
    badge: 'bg-gray-100 text-gray-600 ring-gray-200/60',
    chip: 'from-gray-400 to-gray-500 ring-gray-200',
  },
};

const FALLBACK_META = {
  label: 'Member',
  badge: 'bg-gray-100 text-gray-600 ring-gray-200/60',
  chip: 'from-gray-400 to-gray-500 ring-gray-200',
};

const metaOf = (role: string) => ROLE_META[role] || { ...FALLBACK_META, label: role };

export default function AdminDirectoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchDirectory = useCallback(async () => {
    try {
      const data = await apiGet<DirectoryEntry[]>('/api/v1/directory');
      setEntries(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return entries;
    return entries.filter((entry) =>
      [
        entry.name,
        entry.email,
        entry.unitNumber || '',
        entry.buildingName || '',
        metaOf(entry.role).label,
      ].some((value) => value.toLowerCase().includes(q))
    );
  }, [entries, q]);

  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, DirectoryEntry[]>>((acc, entry) => {
        const key = entry.buildingName || 'Unassigned';
        if (!acc[key]) acc[key] = [];
        acc[key].push(entry);
        return acc;
      }, {}),
    [filtered],
  );

  // Stats always describe the whole society, never the current search
  const totalResidents = entries.filter((e) => e.role === 'RESIDENT').length;
  const totalUnits = new Set(entries.filter((e) => e.unitNumber).map((e) => e.unitNumber)).size;
  const buildingCount = new Set(entries.map((e) => e.buildingName || 'Unassigned')).size;

  if (loading && entries.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc] text-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          <p className="text-body-sm text-gray-500">Loading directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/admin')}
            aria-label="Back to dashboard"
            className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Resident Directory</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">Everyone with access to your society, by building</p>
          </div>
        </div>

        {/* Stats - always the full society, even while searching */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Users, label: 'Members', value: entries.length, tone: 'text-accent-600', bg: 'bg-accent-50' },
            { icon: UserIcon, label: 'Residents', value: totalResidents, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: Home, label: 'Units', value: totalUnits, tone: 'text-amber-600', bg: 'bg-amber-50' },
            { icon: Building2, label: 'Buildings', value: buildingCount, tone: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.tone}`} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{stat.label}</span>
              </div>
              <p className="text-display font-display tabular-nums text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search - always visible so a query can never strand you */}
        <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, unit, or building..."
              aria-label="Search the directory"
              className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-3 border-t border-gray-100 pt-3 text-caption-xs text-gray-400">
            {q
              ? `Showing ${filtered.length} of ${entries.length} member${entries.length === 1 ? '' : 's'} matching “${query.trim()}”.`
              : `${entries.length} member${entries.length === 1 ? '' : 's'} across ${buildingCount} building${buildingCount === 1 ? '' : 's'}.`}
          </p>
        </div>

        {/* Directory */}
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <Users className="h-7 w-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No residents found</h3>
            <p className="mx-auto max-w-sm text-body-sm text-gray-500">
              Invite residents to see them here.
            </p>
            <button
              onClick={() => router.push('/dashboard/admin/memberships')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <Users className="h-4 w-4" /> Go to residents
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <UserSearch className="h-7 w-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No members matched</h3>
            <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
              Nothing in the directory matches “{query.trim()}”. Try a name, an email address, a unit number or a building.
            </p>
            <button
              onClick={() => setQuery('')}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <X className="h-4 w-4" /> Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([buildingName, members]) => (
              <div key={buildingName} className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                {/* Building header */}
                <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-accent-50/80 to-transparent px-5 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-body font-semibold text-gray-900">{buildingName}</h3>
                  <span className="ml-auto rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent-700 ring-1 ring-accent-200/60">
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Members */}
                <div className="divide-y divide-gray-100">
                  {members.map((entry) => {
                    const meta = metaOf(entry.role);
                    return (
                      <div
                        key={entry.userId}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/dashboard/admin/directory/${entry.userId}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/dashboard/admin/directory/${entry.userId}`);
                          }
                        }}
                        className="group flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-accent-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                      >
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.chip} ring-1 transition-transform duration-300 group-hover:scale-110`}>
                          <UserIcon className="h-4 w-4 text-white" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span className="truncate text-body font-semibold text-gray-900 transition-colors group-hover:text-accent-700">
                              {entry.name}
                            </span>
                            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${meta.badge}`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                              <Mail className="h-3 w-3 text-gray-400" />
                              {entry.email}
                            </span>
                            {entry.unitNumber && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                                <Home className="h-3 w-3 text-gray-400" />
                                Unit {entry.unitNumber}
                                {entry.floor !== null && ` · Floor ${entry.floor}`}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent-500" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
