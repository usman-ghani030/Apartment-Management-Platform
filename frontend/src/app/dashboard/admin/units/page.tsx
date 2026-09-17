'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Home, Edit3, Trash2, X, Save, Search, Upload, Building2, User, UserX } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { CsvImportModal } from '@/components/ui/CsvImportModal';
import { auth, ApiError, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

interface Building {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unitNumber: string;
  floor: number;
  type: string;
  bedroomType: string | null;
  buildingId: string;
  buildingName: string;
  residentCount: number;
  primaryContactName: string | null;
  occupantName: string | null;
  hasLinkedResident: boolean;
}

const UNIT_TYPES = [
  { value: 'OWNER_OCCUPIED', label: 'Owner Occupied' },
  { value: 'RENTED', label: 'Rented' },
  { value: 'VACANT', label: 'Vacant' },
];

const BEDROOM_TYPES = [
  { value: 'STUDIO', label: 'Studio' },
  { value: 'ONE_BED', label: '1 Bedroom' },
  { value: 'TWO_BED', label: '2 Bedrooms' },
  { value: 'THREE_BED', label: '3 Bedrooms' },
  { value: 'FOUR_BED', label: '4 Bedrooms' },
  { value: 'FOUR_PLUS_BED', label: '4+ Bedrooms' },
];

export default function AdminUnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showTypeFilter, setShowTypeFilter] = useState('');
  const [showBedroomFilter, setShowBedroomFilter] = useState('');
  const [search, setSearch] = useState('');

  const [unitNumber, setUnitNumber] = useState('');
  const [floor, setFloor] = useState('1');
  const [type, setType] = useState('VACANT');
  const [buildingId, setBuildingId] = useState('');
  const [bedroomType, setBedroomType] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Bulk CSV import - the shared flow lives in components/ui/CsvImportModal.tsx
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    auth.me().catch(() => router.push('/login'));
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const [unitsData, buildingsData] = await Promise.all([
        apiGet<Unit[]>('/api/v1/units'),
        apiGet<Building[]>('/api/v1/buildings'),
      ]);
      setUnits(unitsData || []);
      setBuildings(buildingsData || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUnitNumber(''); setFloor('1'); setType('VACANT'); setBuildingId(''); setBedroomType(''); setPrimaryContactName(''); setPrimaryContactEmail(''); setPrimaryContactPhone(''); setEditId(null); setShowForm(false); setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    // The building picker is a custom dropdown, so validate it here rather than
    // relying on the browser's native required handling.
    if (!buildingId) { setError('Choose the building this unit belongs to'); setSaving(false); return; }
    try {
      const payload: Record<string, unknown> = {
        unitNumber,
        floor: parseInt(floor, 10),
        type,
        buildingId,
        bedroomType: bedroomType || null,
        primaryContactName: primaryContactName || null,
        primaryContactEmail: primaryContactEmail || null,
        primaryContactPhone: primaryContactPhone || null,
      };
      if (editId) {
        await apiPatch(`/api/v1/units/${editId}`, payload);
      } else {
        await apiPost('/api/v1/units', payload);
      }
      resetForm();
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, unitNumber: string) => {
    if (!confirm(`Delete unit "${unitNumber}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/v1/units/${id}`);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert('Failed to delete unit');
    }
  };

  const startEdit = async (u: Unit) => {
    setUnitNumber(u.unitNumber);
    setFloor(String(u.floor));
    setType(u.type);
    setBuildingId(u.buildingId);
    setBedroomType(u.bedroomType || '');
    setPrimaryContactName(u.primaryContactName || '');
    setPrimaryContactEmail('');
    setPrimaryContactPhone('');
    setEditId(u.id);
    setShowForm(true);
    try {
      const detail = await apiGet<{ primaryContactEmail: string | null; primaryContactPhone: string | null }>(`/api/v1/units/${u.id}`);
      setPrimaryContactEmail(detail.primaryContactEmail || '');
      setPrimaryContactPhone(detail.primaryContactPhone || '');
    } catch {
      // Best-effort
    }
  };

  // Derived stats
  const occupied = units.filter((u) => u.hasLinkedResident || u.occupantName).length;
  const vacant = units.length - occupied;
  const byType = UNIT_TYPES.map((t) => ({
    ...t,
    count: units.filter((u) => u.type === t.value).length,
    dot: t.value === 'OWNER_OCCUPIED' ? 'bg-accent-500' : t.value === 'RENTED' ? 'bg-emerald-500' : 'bg-amber-400',
  }));
  const bedroomCounts = units.reduce<Record<string, number>>((acc, u) => {
    if (u.bedroomType) acc[u.bedroomType] = (acc[u.bedroomType] || 0) + 1;
    return acc;
  }, {});
  const hasFilters = Boolean(showTypeFilter || showBedroomFilter || search);
  const clearFilters = () => { setShowTypeFilter(''); setShowBedroomFilter(''); setSearch(''); };
  const q = search.toLowerCase();
  const filtered = units.filter((u) => {
    if (showTypeFilter && u.type !== showTypeFilter) return false;
    if (showBedroomFilter && u.bedroomType !== showBedroomFilter) return false;
    return (
      !search ||
      u.unitNumber.toLowerCase().includes(q) ||
      u.buildingName.toLowerCase().includes(q) ||
      (u.occupantName && u.occupantName.toLowerCase().includes(q)) ||
      (u.primaryContactName && u.primaryContactName.toLowerCase().includes(q)) ||
      (u.bedroomType && u.bedroomType.toLowerCase().replace('_', ' ').includes(q))
    );
  });

  if (loading) {
    return <PageSkeleton width="max-w-5xl" />;
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
            <h1 className="text-2xl font-display font-bold text-gray-900">Units</h1>
            <p className="text-body-sm text-gray-500 mt-0.5">Manage apartments and flats</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:border-accent-200 hover:bg-accent-50/50 text-gray-700 rounded-xl px-4 py-2.5 text-body-sm font-medium transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl px-4 py-2.5 text-body-sm font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Unit
            </button>
          </div>
        </div>

        {/* Stats row */}
        {units.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Home, label: 'Total units', value: units.length, color: 'text-accent-600', bg: 'bg-accent-50' },
              { icon: User, label: 'Occupied', value: occupied, color: 'text-accent-600', bg: 'bg-accent-50' },
              { icon: UserX, label: 'Vacant', value: vacant, color: 'text-accent-600', bg: 'bg-accent-50' },
              { icon: Building2, label: 'Buildings', value: buildings.length, color: 'text-accent-600', bg: 'bg-accent-50' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{stat.label}</span>
                </div>
                <p className="text-display font-display text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        {units.length > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {/* Occupancy filter - its own row so the chips never get squeezed */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                Occupancy
              </span>
              {[
                { value: '', label: 'All', count: units.length, dot: '' },
                ...byType.map((t) => ({ value: t.value, label: t.label, count: t.count, dot: t.dot })),
              ].map((f) => {
                const active = showTypeFilter === f.value;
                return (
                  <button
                    key={f.value || 'all'}
                    onClick={() => setShowTypeFilter(f.value)}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-body-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,1)]'
                        : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {f.dot && <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />}
                    {f.label}
                    <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search + bedroom type on their own row */}
            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by unit number, building, or occupant..."
                  aria-label="Search units"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="lg:w-64">
                <Select value={showBedroomFilter} onChange={(e) => setShowBedroomFilter(e.target.value)}>
                  <option value="">All bedroom types</option>
                  {BEDROOM_TYPES.map((bt) => (
                    <option key={bt.value} value={bt.value}>
                      {bt.label}{bedroomCounts[bt.value] ? ` (${bedroomCounts[bt.value]})` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-body-sm font-medium text-gray-500 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        <Modal
          open={showForm}
          onClose={resetForm}
          icon={Home}
          title={editId ? 'Edit unit' : 'Add unit'}
          subtitle={editId
            ? 'Update this flat’s details and contact person.'
            : 'Add a flat, then assign a resident to it from the Residents page.'}
          size="md"
        >
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Location ─────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Location</span>
                <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="unit-building">Building</label>
                <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} required>
                  <option value="">Select building...</option>
                  {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={fieldLabel} htmlFor="unit-number">Unit number</label>
                  <input id="unit-number" type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="e.g. 101" required maxLength={20} className={fieldInput} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="unit-floor">Floor</label>
                  <input id="unit-floor" type="number" min="0" max="500" value={floor} onChange={(e) => setFloor(e.target.value)} required className={fieldInput} />
                </div>
              </div>
            </div>

            {/* ── Details ──────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Details</span>
                <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={fieldLabel} htmlFor="unit-type">Occupancy</label>
                  <Select value={type} onChange={(e) => setType(e.target.value)}>
                    {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="unit-bedrooms">Bedroom type</label>
                  <Select value={bedroomType} onChange={(e) => setBedroomType(e.target.value)}>
                    <option value="">Not specified</option>
                    {BEDROOM_TYPES.map((bt) => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Primary contact (optional) ───────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Primary contact</span>
                <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
                <span className="text-caption-xs text-gray-400">Optional</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input type="text" value={primaryContactName} onChange={(e) => setPrimaryContactName(e.target.value)} placeholder="Name" className={fieldInput} />
                <input type="email" value={primaryContactEmail} onChange={(e) => setPrimaryContactEmail(e.target.value)} placeholder="Email" className={fieldInput} />
                <input type="tel" value={primaryContactPhone} onChange={(e) => setPrimaryContactPhone(e.target.value)} placeholder="Phone" className={fieldInput} />
              </div>
            </div>

            {/* ── Actions ──────────────────────────────────────── */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={saving}
                className="flex-[1.4] bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-body-sm font-medium flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editId ? 'Update unit' : 'Create unit'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Import CSV Modal - the same shared flow the Buildings page uses */}
        <CsvImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          title="Import units from CSV"
          subtitle="One row per unit. Buildings that do not exist yet are created automatically."
          entityPlural="units"
          sample={{ url: '/api/v1/import/sample-csv', fileName: 'sample-units-import.csv' }}
          validateUrl="/api/v1/import/validate"
          confirmUrl="/api/v1/import/confirm"
          columns={[
            { label: 'Building', value: (row) => row['Building Name'] },
            { label: 'Unit', value: (row) => row['Unit Number'] },
            { label: 'Floor', value: (row) => row['Floor'] },
            { label: 'Bedroom', value: (row) => row['Bedroom Type'] },
            { label: 'Contact', value: (row) => row['Primary Contact Name'] || '-' },
          ]}
          describeSkip={(skip) => `${String(skip.buildingName || '')} / ${String(skip.unitNumber || '')}`}
          onImported={fetchData}
        />

        {/* Units List */}
        {units.length === 0 ? (
          <div className="bg-white border border-gray-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto mb-5">
              <Home className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="text-title font-display text-gray-900 mb-2">No units yet</h3>
            <p className="text-body-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Create buildings first, then add units to each one. You can also import units in bulk from a CSV file.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push('/dashboard/admin/buildings')}
                className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl px-5 py-2.5 text-body-sm font-medium transition-all"
              >
                <Building2 className="w-4 h-4" /> Go to Buildings
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:border-accent-200 text-gray-700 rounded-xl px-5 py-2.5 text-body-sm font-medium transition-all"
              >
                <Upload className="w-4 h-4" /> Import CSV
              </button>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl px-5 py-2.5 text-body-sm font-medium shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Add Unit
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <Search className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="text-title font-display text-gray-900 mb-2">No units match these filters</h3>
            <p className="text-body-sm text-gray-500 mb-6">
              {search ? `Nothing matched “${search}”. ` : ''}Try widening the occupancy or bedroom type filter.
            </p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((u) => {
              const typeInfo = UNIT_TYPES.find((t) => t.value === u.type);
              const bedroomInfo = u.bedroomType ? BEDROOM_TYPES.find((bt) => bt.value === u.bedroomType) : null;
              const isVacant = u.type === 'VACANT';
              const isLinked = u.hasLinkedResident;

              // Colour marks status exactly once, in the pill. The row itself stays
              // on the single blue accent so the list reads as one system.
              const statusBg = isVacant
                ? 'bg-amber-50 text-amber-700 ring-amber-200/60'
                : isLinked
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/60'
                  : 'bg-accent-50 text-accent-700 ring-accent-200/60';
              const statusDot = isVacant ? 'bg-amber-400' : isLinked ? 'bg-emerald-400' : 'bg-accent-400';
              const statusLabel = isVacant ? 'Vacant' : isLinked ? 'Linked' : 'Occupied';
              const residentName = u.occupantName || u.primaryContactName;

              return (
                <div
                  key={u.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent-500 transition-all duration-300 group-hover:w-1.5" aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-7 gap-y-5 pl-6 pr-5 py-5">
                    {/* Identity - also the link through to the unit */}
                    <button
                      onClick={() => router.push(`/dashboard/admin/units/${u.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-none"
                    >
                      <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_10px_24px_-12px_rgba(37,99,235,1)]">
                        <Home className="h-5 w-5 text-white" />
                        <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Unit</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusBg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                            {statusLabel}
                          </span>
                        </div>
                        <h3 className="mt-0.5 truncate text-title-sm font-display text-gray-900 transition-colors group-hover:text-accent-700">
                          {u.unitNumber}
                        </h3>
                        <p className="truncate text-caption-xs text-gray-500">{u.buildingName}</p>
                      </div>
                    </button>

                    {/* Labelled detail */}
                    <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3.5 sm:w-auto sm:flex-[1.7] sm:grid-cols-4">
                      <Field label="Floor">{u.floor}</Field>
                      <Field label="Type">{typeInfo?.label ?? u.type}</Field>
                      <Field label="Bedrooms">{bedroomInfo?.label ?? 'Not specified'}</Field>
                      <Field label="Resident">{residentName || 'No resident'}</Field>
                    </div>

                    {/* Actions */}
                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0">
                      <button
                        onClick={() => startEdit(u)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-body-sm font-medium text-accent-700 transition-all hover:border-accent-300 hover:bg-accent-100"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.unitNumber)}
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
