'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Search, Building2, Home, Mail, User as UserIcon } from 'lucide-react';
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

export default function AdminDirectoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');

  const fetchDirectory = useCallback(async () => {
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : '';
      const data = await apiGet<DirectoryEntry[]>(`/api/v1/directory${params}`);
      setEntries(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router, search]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  // Debounce search: update input immediately, debounce API call
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const handleSearch = (value: string) => {
    setInputValue(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setSearch(value);
    }, 300));
  };

  // Group by building
  const grouped = entries.reduce<Record<string, DirectoryEntry[]>>((acc, entry) => {
    const key = entry.buildingName || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      COMMITTEE_ADMIN: 'bg-accent-50 text-accent-500',
      RESIDENT: 'bg-accent-50 text-accent-600',
      SECURITY_GUARD: 'bg-green-500/10 text-green-400',
      VENDOR: 'bg-yellow-500/10 text-yellow-400',
    };
    return colors[role] || 'bg-gray-500/10 text-gray-700';
  };

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center ">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalResidents = entries.filter((e) => e.role === 'RESIDENT').length;
  const totalUnits = new Set(entries.filter((e) => e.unitNumber).map((e) => e.unitNumber)).size;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Resident Directory</h1>
              <p className="text-gray-700 text-sm">View all residents in your society</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold">{entries.length}</p>
            <p className="text-xs text-gray-700">Total Members</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold">{totalResidents}</p>
            <p className="text-xs text-gray-700">Residents</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold">{totalUnits}</p>
            <p className="text-xs text-gray-700">Occupied Units</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
          <input
            type="text"
            placeholder="Search by name, email, unit, or building..."
            value={inputValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
          />
        </div>

        {/* Directory */}
        {entries.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No residents found</p>
            <p className="text-gray-700 text-sm mt-1">Invite residents to see them here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([buildingName, members]) => (
              <div key={buildingName} className="bg-white border border-gray-200 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-white/[0.02] border-b border-gray-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent-500" />
                  <h3 className="font-semibold text-sm">{buildingName}</h3>
                  <span className="text-xs text-gray-700 ml-auto">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-white/5">
                  {members.map((entry) => (
                    <div key={entry.userId} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="w-9 h-9 bg-accent-50 rounded-full flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-4 h-4 text-accent-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{entry.name}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${roleBadge(entry.role)}`}>
                            {entry.role === 'COMMITTEE_ADMIN' ? 'Admin' : entry.role === 'RESIDENT' ? 'Resident' : entry.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-700 mt-0.5">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {entry.email}</span>
                          {entry.unitNumber && (
                            <span className="flex items-center gap-1"><Home className="w-3 h-3" /> {entry.unitNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
