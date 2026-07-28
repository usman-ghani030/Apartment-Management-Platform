'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Building2, Edit3, Trash2, X, Save } from 'lucide-react';
import { auth, ApiError, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center ">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Buildings</h1>
            <p className="text-gray-700 text-sm mt-1">Manage society buildings and blocks</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setName(''); }}
            className="ml-auto flex items-center gap-2 bg-accent-600 hover:bg-accent-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" /> Add Building
          </button>
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 w-full max-w-md border border-gray-200 mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">{editId ? 'Edit Building' : 'Add Building'}</h2>
                <button onClick={() => { setShowForm(false); setEditId(null); setName(''); setError(''); }} className="p-1 hover:bg-gray-50 rounded-lg">
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
              )}

              <form onSubmit={editId ? handleUpdate : handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Building Name</label>
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Building A, Tower 1"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
                  />
                </div>
                <button
                  type="submit" disabled={saving}
                  className="w-full bg-accent-600 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : editId ? 'Update Building' : 'Create Building'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Buildings List */}
        {buildings.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center border border-gray-200">
            <Building2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No buildings yet</p>
            <p className="text-gray-700 text-sm mt-1">Create your first building to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {buildings.map((b) => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 border border-gray-200 hover:border-accent-500/30 transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-accent-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{b.name}</h3>
                    <p className="text-xs text-gray-700">{b.unitCount} unit(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(b)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 hover:text-accent-500">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(b.id, b.name)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 hover:text-red-400">
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
