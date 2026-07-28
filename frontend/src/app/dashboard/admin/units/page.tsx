'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Home, Edit3, Trash2, X, Save } from 'lucide-react';
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
  buildingId: string;
  buildingName: string;
  residentCount: number;
}

const UNIT_TYPES = [
  { value: 'OWNER_OCCUPIED', label: 'Owner Occupied' },
  { value: 'RENTED', label: 'Rented' },
  { value: 'VACANT', label: 'Vacant' },
];

export default function AdminUnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [unitNumber, setUnitNumber] = useState('');
  const [floor, setFloor] = useState('1');
  const [type, setType] = useState('VACANT');
  const [buildingId, setBuildingId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    setUnitNumber(''); setFloor('1'); setType('VACANT'); setBuildingId(''); setEditId(null); setShowForm(false); setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { unitNumber, floor: parseInt(floor, 10), type, buildingId };
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

  const startEdit = (u: Unit) => {
    setUnitNumber(u.unitNumber);
    setFloor(String(u.floor));
    setType(u.type);
    setBuildingId(u.buildingId);
    setEditId(u.id);
    setShowForm(true);
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
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="ml-auto flex items-center gap-2 bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" /> Add Unit
          </button>
        </div>

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
                    <input type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="e.g. 101" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Floor</label>
                    <input type="number" min="0" value={floor} onChange={(e) => setFloor(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50">
                    {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={saving} className="w-full bg-accent-600 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : editId ? 'Update Unit' : 'Create Unit'}
                </button>
              </form>
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
        ) : (
          <div className="space-y-2">
            {units.map((u) => (
              <div key={u.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border border-gray-200 hover:border-accent-500/30 transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
                    <Home className="w-5 h-5 text-accent-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{u.unitNumber}</h3>
                    <p className="text-xs text-gray-700">
                      {u.buildingName} · Floor {u.floor} · {UNIT_TYPES.find((t) => t.value === u.type)?.label || u.type}
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
        )}
      </div>
    </div>
  );
}
