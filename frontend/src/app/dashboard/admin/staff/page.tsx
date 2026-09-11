'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, Plus, Search, Shield, Phone, Mail,
  CheckCircle, XCircle, Edit2, Trash2, X,
} from 'lucide-react';
import { ApiError, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type { StaffResponse, StaffRole } from '@apartment/shared';

const ROLE_LABELS: Record<StaffRole, string> = {
  GUARD: 'Guard',
  CLEANER: 'Cleaner',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

const ROLE_COLORS: Record<StaffRole, string> = {
  GUARD: 'bg-blue-500/10 text-blue-500',
  CLEANER: 'bg-emerald-500/10 text-emerald-500',
  MAINTENANCE: 'bg-orange-500/10 text-orange-500',
  OTHER: 'bg-gray-500/10 text-gray-500',
};

const ROLE_ICONS: Record<StaffRole, React.ElementType> = {
  GUARD: Shield,
  CLEANER: CheckCircle,
  MAINTENANCE: Edit2,
  OTHER: Users,
};

export default function AdminStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<StaffRole>('GUARD');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStaff = useCallback(async () => {
    try {
      const data = await apiGet<StaffResponse[]>('/api/v1/staff');
      setStaff(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const resetForm = () => {
    setFormName('');
    setFormRole('GUARD');
    setFormEmail('');
    setFormPhone('');
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (s: StaffResponse) => {
    setFormName(s.name);
    setFormRole(s.role);
    setFormEmail(s.email || '');
    setFormPhone(s.phone || '');
    setEditingId(s.id);
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const body: any = {
        name: formName.trim(),
        role: formRole,
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
      };
      if (editingId) {
        await apiPatch(`/api/v1/staff/${editingId}`, body);
        setSuccess('Staff member updated');
      } else {
        await apiPost('/api/v1/staff', body);
        setSuccess('Staff member added');
      }
      resetForm();
      fetchStaff();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (s: StaffResponse) => {
    setError('');
    setSuccess('');
    try {
      await apiPatch(`/api/v1/staff/${s.id}`, { isActive: !s.isActive });
      setSuccess(`Staff member ${s.isActive ? 'deactivated' : 'activated'}`);
      fetchStaff();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    setError('');
    setSuccess('');
    try {
      await apiDelete(`/api/v1/staff/${id}`);
      setSuccess('Staff member deleted');
      fetchStaff();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const filteredStaff = staff.filter((s) => {
    if (filterActive === 'ACTIVE' && !s.isActive) return false;
    if (filterActive === 'INACTIVE' && s.isActive) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        ROLE_LABELS[s.role].toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: staff.length,
    active: staff.filter((s) => s.isActive).length,
    guards: staff.filter((s) => s.role === 'GUARD' && s.isActive).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/dashboard/admin')}
            className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-700 text-sm">Manage guards, cleaners, and maintenance staff</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-700">Total Staff</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-xs text-green-500">Active</p>
            <p className="text-2xl font-bold mt-1">{stats.active}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-xs text-blue-500">Active Guards</p>
            <p className="text-2xl font-bold mt-1">{stats.guards}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">
            {success}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? 'Edit Staff Member' : 'Add Staff Member'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ahmed Khan"
                  required
                  maxLength={100}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as StaffRole)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-accent-500/50"
                >
                  {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="ahmed@example.com"
                  maxLength={200}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  maxLength={20}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition-all"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Staff' : 'Add Staff'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm text-gray-700 hover:text-gray-900 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, or role..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
            />
          </div>
          <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterActive(f)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  filterActive === f ? 'bg-accent-600 text-white' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Staff List */}
        {filteredStaff.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No staff members found</p>
            <p className="text-gray-700 text-sm mt-1">
              {filterActive !== 'ALL' ? 'Try a different filter' : 'Add staff using the button above'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStaff.map((s) => {
              const RoleIcon = ROLE_ICONS[s.role];
              return (
                <div
                  key={s.id}
                  className={`bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-accent-500/20 transition-colors ${
                    !s.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${ROLE_COLORS[s.role]}`}>
                        <RoleIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{s.name}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[s.role]}`}>
                            {ROLE_LABELS[s.role]}
                          </span>
                          {!s.isActive && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
                          {s.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {s.email}
                            </span>
                          )}
                          {s.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {s.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(s)}
                        className="p-2 text-gray-700 hover:text-accent-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`p-2 rounded-lg transition-colors ${
                          s.isActive
                            ? 'text-gray-700 hover:text-orange-600 hover:bg-gray-50'
                            : 'text-gray-700 hover:text-green-600 hover:bg-gray-50'
                        }`}
                        title={s.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {s.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-2 text-gray-700 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
