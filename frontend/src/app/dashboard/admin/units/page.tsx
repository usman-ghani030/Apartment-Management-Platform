'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Home, Edit3, Trash2, X, Save, Search, Upload, Download, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { auth, ApiError, apiGet, apiPost, apiPatch, apiDelete, apiUpload, getAuthToken, API_BASE } from '@/lib/api';

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

  // CSV Import state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [importPreview, setImportPreview] = useState<{
    toCreate: Record<string, string>[];
    toSkip: { row: number; buildingName: string; unitNumber: string; reason: string }[];
    errors: { row: number; reason: string }[];
    totalRows: number;
  } | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    errors: number;
    totalRows: number;
  } | null>(null);

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

  const resetImport = () => {
    setShowImport(false);
    setImportFile(null);
    setImportStep('upload');
    setImportPreview(null);
    setImportError('');
    setImportResult(null);
    setImporting(false);
  };

  const handleDownloadSample = async () => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['x-access-token'] = token;
      const res = await fetch(`${API_BASE}/api/v1/import/sample-csv`, { credentials: 'include', headers });
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample-units-import.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download sample CSV');
    }
  };

  const handleUploadCSV = async () => {
    if (!importFile) return;
    setImportError('');
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const result = await apiUpload<{
        toCreate: Record<string, string>[];
        toSkip: { row: number; buildingName: string; unitNumber: string; reason: string }[];
        errors: { row: number; reason: string }[];
        totalRows: number;
      }>('/api/v1/import/validate', formData);
      setImportPreview(result);
      setImportStep('preview');
    } catch (err) {
      if (err instanceof ApiError) setImportError(err.message);
      else setImportError('Failed to validate CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.toCreate.length === 0) return;
    setImportError('');
    setImporting(true);
    setImportStep('importing');
    try {
      const result = await apiPost<{
        created: number;
        skipped: number;
        errors: number;
        totalRows: number;
      }>('/api/v1/import/confirm', { toCreate: importPreview.toCreate });
      setImportResult(result);
      setImportStep('done');
      fetchData(); // refresh the units list
    } catch (err) {
      if (err instanceof ApiError) setImportError(err.message);
      else setImportError('Failed to import');
      setImportStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
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
    // The list response only carries the contact name — fetch the full unit so
    // existing contact email/phone are shown (and not silently wiped on save).
    setPrimaryContactEmail('');
    setPrimaryContactPhone('');
    setEditId(u.id);
    setShowForm(true);
    try {
      const detail = await apiGet<{ primaryContactEmail: string | null; primaryContactPhone: string | null }>(`/api/v1/units/${u.id}`);
      setPrimaryContactEmail(detail.primaryContactEmail || '');
      setPrimaryContactPhone(detail.primaryContactPhone || '');
    } catch {
      // Best-effort — fields stay blank if the detail call fails.
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center ">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Units</h1>
            <p className="text-gray-700 text-sm mt-1">Manage apartments and flats</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { resetImport(); setShowImport(true); }}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" /> Add Unit
            </button>
          </div>
        </div>

        {/* Search */}
        {units.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
            <input
              type="text"
              placeholder="Search by unit number, building, or occupant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
            />
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 w-full max-w-md border border-gray-200 mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">{editId ? 'Edit Unit' : 'Add Unit'}</h2>
                <button onClick={resetForm} className="p-1 hover:bg-gray-50 rounded-lg">
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Building</label>
                  <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50">
                    <option value="">Select building...</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Number</label>
                    <input type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="e.g. 101" required maxLength={20} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Floor</label>
                    <input type="number" min="0" max="500" value={floor} onChange={(e) => setFloor(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50">
                      {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Bedroom Type</label>
                    <select value={bedroomType} onChange={(e) => setBedroomType(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50">
                      <option value="">Select...</option>
                      {BEDROOM_TYPES.map((bt) => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Primary Contact (optional)</p>
                  <div className="space-y-3">
                    <input type="text" value={primaryContactName} onChange={(e) => setPrimaryContactName(e.target.value)} placeholder="Contact name" maxLength={100} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                    <input type="email" value={primaryContactEmail} onChange={(e) => setPrimaryContactEmail(e.target.value)} placeholder="Contact email" maxLength={200} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                    <input type="tel" value={primaryContactPhone} onChange={(e) => setPrimaryContactPhone(e.target.value)} placeholder="Contact phone" maxLength={30} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                  </div>
                </div>
                <button type="submit" disabled={saving} className="w-full bg-accent-600 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : editId ? 'Update Unit' : 'Create Unit'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Import CSV Modal */}
        {showImport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Import Units from CSV</h2>
                <button onClick={resetImport} className="p-1 hover:bg-gray-50 rounded-lg">
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {importError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{importError}</div>
              )}

              {/* Step 1: Upload */}
              {importStep === 'upload' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">
                    Upload a CSV file with one row per unit. Buildings that don't exist yet will be created automatically.
                  </p>
                  <button onClick={handleDownloadSample} className="flex items-center gap-2 text-accent-600 hover:text-accent-700 text-sm font-medium">
                    <Download className="w-4 h-4" /> Download sample CSV
                  </button>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-2">Drag and drop your CSV file here, or</p>
                    <label className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-all">
                      <Upload className="w-4 h-4" /> Choose file
                      <input type="file" accept='.csv' className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                    </label>
                    {importFile && <p className="text-sm text-gray-700 mt-3">Selected: {importFile.name}</p>}
                  </div>
                  <button
                    onClick={handleUploadCSV}
                    disabled={!importFile || importing}
                    className="w-full bg-accent-600 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Validating...</> : <>Validate CSV</>}
                  </button>
                </div>
              )}

              {/* Step 2: Preview */}
              {importStep === 'preview' && importPreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{importPreview.toCreate.length}</p>
                      <p className="text-xs text-green-600">Will create</p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{importPreview.toSkip.length}</p>
                      <p className="text-xs text-yellow-600">Skipped (duplicates)</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{importPreview.errors.length}</p>
                      <p className="text-xs text-red-600">Errors</p>
                    </div>
                  </div>

                  {importPreview.toSkip.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500" /> Skipped rows</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importPreview.toSkip.map((s, i) => (
                          <div key={i} className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-yellow-700">
                            Row {s.row}: {s.buildingName} / {s.unitNumber} — {s.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importPreview.errors.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Validation errors</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importPreview.errors.map((e, i) => (
                          <div key={i} className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700">
                            Row {e.row}: {e.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importPreview.toCreate.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Preview (first 10 rows)</h4>
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-gray-200"><th className="text-left py-1 px-2 text-gray-500">Building</th><th className="text-left py-1 px-2 text-gray-500">Unit</th><th className="text-left py-1 px-2 text-gray-500">Floor</th><th className="text-left py-1 px-2 text-gray-500">Bedroom</th><th className="text-left py-1 px-2 text-gray-500">Contact</th></tr></thead>
                          <tbody>
                            {importPreview.toCreate.slice(0, 10).map((r, i) => (
                              <tr key={i} className="border-b border-gray-100">
                                <td className="py-1 px-2">{r['Building Name']}</td>
                                <td className="py-1 px-2">{r['Unit Number']}</td>
                                <td className="py-1 px-2">{r['Floor']}</td>
                                <td className="py-1 px-2">{r['Bedroom Type']}</td>
                                <td className="py-1 px-2">{r['Primary Contact Name'] || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importPreview.toCreate.length > 10 && <p className="text-xs text-gray-500 mt-1">...and {importPreview.toCreate.length - 10} more</p>}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => { setImportStep('upload'); setImportFile(null); setImportPreview(null); }} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg py-2.5 text-sm font-medium">Back</button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={importPreview.toCreate.length === 0 || importing}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Confirm Import ({importPreview.toCreate.length} units)
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Importing */}
              {importStep === 'importing' && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-accent-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-700 font-medium">Importing units...</p>
                  <p className="text-gray-500 text-sm mt-1">This may take a moment for large files.</p>
                </div>
              )}

              {/* Step 4: Done */}
              {importStep === 'done' && importResult && (
                <div className="space-y-4 text-center py-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                  <h3 className="text-lg font-semibold text-gray-900">Import Complete</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                      <p className="text-xs text-green-600">Created</p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
                      <p className="text-xs text-yellow-600">Skipped</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
                      <p className="text-xs text-red-600">Errors</p>
                    </div>
                  </div>
                  <button onClick={resetImport} className="bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-6 py-2.5 text-sm font-medium">Done</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Units List */}
        {units.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center border border-gray-200">
            <Home className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No units yet</p>
            <p className="text-gray-700 text-sm mt-1">Create buildings first, then add units</p>
          </div>
        ) : (() => {
          const q = search.toLowerCase();
          const filtered = units.filter((u) =>
            !search ||
            u.unitNumber.toLowerCase().includes(q) ||
            u.buildingName.toLowerCase().includes(q) ||
            (u.occupantName && u.occupantName.toLowerCase().includes(q)) ||
            (u.primaryContactName && u.primaryContactName.toLowerCase().includes(q)) ||
            (u.bedroomType && u.bedroomType.toLowerCase().replace('_', ' ').includes(q))
          );
          if (filtered.length === 0) {
            return (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No units match "{search}"</p>
                <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
              </div>
            );
          }
          return (
          <div className="space-y-2">
            {filtered.map((u) => (
              <div key={u.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200 hover:border-accent-500/30 transition-all flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => router.push(`/dashboard/admin/units/${u.id}`)}>
                  <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
                    <Home className="w-5 h-5 text-accent-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{u.unitNumber}</h3>
                    <p className="text-xs text-gray-700">
                      {u.buildingName} · Floor {u.floor} · {UNIT_TYPES.find((t) => t.value === u.type)?.label || u.type}
                      {u.bedroomType && ` · ${BEDROOM_TYPES.find((bt) => bt.value === u.bedroomType)?.label || u.bedroomType}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {u.hasLinkedResident ? `👤 ${u.occupantName || 'Resident'}` : u.occupantName ? `📋 ${u.occupantName} (not linked)` : '🏠 Vacant'}
                      {u.residentCount > 0 && ` · ${u.residentCount} resident(s)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(u)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 hover:text-accent-500">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(u.id, u.unitNumber)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
