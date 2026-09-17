'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Building2, Edit3, Trash2, Save, Search, Upload, Home, Layers } from 'lucide-react';
import { auth, ApiError, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { CsvImportModal } from '@/components/ui/CsvImportModal';

interface Building {
  id: string;
  name: string;
  unitCount: number;
  createdAt: string;
}

export default function AdminBuildingsPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Bulk CSV import - the shared flow lives in components/ui/CsvImportModal.tsx
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    auth.me().catch(() => router.push('/login'));
    fetchBuildings();
  }, [router]);

  const fetchBuildings = async () => {
    try {
      const data = await apiGet<Building[]>('/api/v1/buildings');
      setBuildings(data || []);
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiPost('/api/v1/buildings', { name });
      setName('');
      setShowForm(false);
      fetchBuildings();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setError('');
    setSaving(true);
    try {
      await apiPatch(`/api/v1/buildings/${editId}`, { name });
      setName('');
      setEditId(null);
      setShowForm(false);
      fetchBuildings();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/v1/buildings/${id}`);
      fetchBuildings();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert('Failed to delete building');
    }
  };

  const startEdit = (b: Building) => {
    setName(b.name);
    setEditId(b.id);
    setShowForm(true);
  };

  // Derived stats
  const totalUnits = buildings.reduce((sum, b) => sum + b.unitCount, 0);
  const avgUnits = buildings.length > 0 ? Math.round(totalUnits / buildings.length) : 0;
  const filtered = buildings.filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading buildings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Buildings</h1>
            <p className="text-body-sm text-gray-500 mt-0.5">Manage society buildings and blocks</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:border-accent-200 hover:bg-accent-50/50 text-gray-700 rounded-xl px-4 py-2.5 text-body-sm font-medium transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button
              onClick={() => { setShowForm(true); setEditId(null); setName(''); }}
              className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl px-4 py-2.5 text-body-sm font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Building
            </button>
          </div>
        </div>

        {/* Stats row */}
        {buildings.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { icon: Building2, label: 'Buildings', value: buildings.length, color: 'text-accent-600', bg: 'bg-accent-50' },
              { icon: Home, label: 'Total units', value: totalUnits, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { icon: Layers, label: 'Avg units / building', value: avgUnits, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                  </div>
                  <span className="text-caption-xs font-semibold uppercase tracking-widest text-gray-400">{stat.label}</span>
                </div>
                <p className="text-display font-display text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {buildings.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search buildings by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200/80 rounded-xl pl-10 pr-4 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:outline-none focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10 transition-all"
            />
          </div>
        )}

        {/* Add/Edit Form Modal */}
        <Modal
          open={showForm}
          onClose={() => { setShowForm(false); setEditId(null); setName(''); setError(''); }}
          icon={Building2}
          title={editId ? 'Edit building' : 'Add building'}
          subtitle={editId
            ? 'Rename this building. Its units and residents are not affected.'
            : 'Buildings group your units into blocks or towers.'}
          size="sm"
        >
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
          )}
          <form onSubmit={editId ? handleUpdate : handleCreate} className="space-y-5">
            <div>
              <label className={fieldLabel} htmlFor="building-name">Building name</label>
              <input
                id="building-name"
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Building A, Tower 1"
                required
                className={fieldInput}
              />
              <p className="mt-2 text-caption-xs text-gray-400">Residents see this name when they pick their unit.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null); setName(''); setError(''); }}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={saving}
                className="flex-[1.4] bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-body-sm font-medium flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editId ? 'Update building' : 'Create building'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Import CSV Modal - same shared flow the Units page uses */}
        <CsvImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          title="Import buildings from CSV"
          subtitle="One row per building. Buildings that do not exist yet are created automatically."
          entityPlural="buildings"
          sample={{ url: '/api/v1/import/sample-csv', fileName: 'sample-import.csv' }}
          validateUrl="/api/v1/import/buildings/validate"
          confirmUrl="/api/v1/import/buildings/confirm"
          columns={[
            { label: 'Building', value: (row) => row['Building Name'] },
            { label: 'Unit', value: (row) => row['Unit Number'] || '-' },
            { label: 'Floor', value: (row) => row['Floor'] || '-' },
            { label: 'Bedroom', value: (row) => row['Bedroom Type'] || '-' },
            { label: 'Contact', value: (row) => row['Primary Contact Name'] || '-' },
          ]}
          describeSkip={(skip) => String(skip.buildingName || '')}
          onImported={fetchBuildings}
        />

        {/* Buildings List */}
        {buildings.length === 0 ? (
          <div className="bg-white border border-gray-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto mb-5">
              <Building2 className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="text-title font-display text-gray-900 mb-2">No buildings yet</h3>
            <p className="text-body-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Create your first building to start organizing units. You can also import buildings in bulk from a CSV file.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl px-5 py-2.5 text-body-sm font-medium transition-all"
              >
                <Upload className="w-4 h-4" /> Import CSV
              </button>
              <button
                onClick={() => { setShowForm(true); setEditId(null); setName(''); }}
                className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl px-5 py-2.5 text-body-sm font-medium shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Add Building
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <Search className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="text-title font-display text-gray-900 mb-2">No buildings match &ldquo;{search}&rdquo;</h3>
            <p className="text-body-sm text-gray-500">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b, idx) => {
              const unitCount = b.unitCount;
              const isEmpty = unitCount === 0;
              const isSmall = unitCount > 0 && unitCount < 10;
              const accentBar = isEmpty ? 'bg-gray-300' : isSmall ? 'bg-accent-500' : 'bg-emerald-500';
              const iconBg = isEmpty
                ? 'from-gray-100 to-gray-50 ring-gray-200'
                : isSmall
                  ? 'from-accent-500 to-accent-600 ring-accent-200'
                  : 'from-emerald-500 to-emerald-600 ring-emerald-200';
              const iconText = isEmpty ? 'text-gray-400' : isSmall ? 'text-white' : 'text-white';
              const countBg = isEmpty
                ? 'bg-gray-100 text-gray-500 ring-gray-200/60'
                : isSmall
                  ? 'bg-accent-50 text-accent-700 ring-accent-200/60'
                  : 'bg-emerald-50 text-emerald-700 ring-emerald-200/60';
              return (
                <div key={b.id} className="group relative bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)] hover:border-accent-200 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                  {/* Colored left accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-4 pl-6 pr-5 py-5">
                    {/* Icon chip */}
                    <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${iconBg} ring-1 flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>                      <Building2 className={`w-5 h-5 ${iconText} transition-colors`} />
                      {/* Subtle glow behind icon on hover */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/dashboard/admin/buildings/${b.id}`)}>
                      <div className="flex items-center gap-3">
                        <h3 className="text-title-sm font-display text-gray-900 group-hover:text-accent-700 transition-colors duration-200">{b.name}</h3>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 transition-all duration-200 ${countBg} group-hover:scale-105`}>
                          <Home className="w-3 h-3" />
                          {unitCount} unit{unitCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {/* Subtle detail line */}
                      <p className="text-caption-xs text-gray-400 mt-1.5">
                        {isEmpty ? 'No units yet' : 'Open to manage its units'}
                        {' '}&middot;{' '}Added {new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0">
                      <button
                        onClick={() => startEdit(b)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-body-sm font-medium text-accent-700 transition-all hover:border-accent-300 hover:bg-accent-100"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(b.id, b.name)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
