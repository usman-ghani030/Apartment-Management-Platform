'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, Plus, Search, Shield, Phone, Mail, X, Edit2, Trash2,
  Power, Sparkles, Wrench, HeartHandshake, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { ApiError, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type { StaffResponse, StaffRole } from '@apartment/shared';

// One palette per role, so a card's accent bar, icon chip and pill all agree.
const ROLE_META: Record<StaffRole, {
  label: string;
  icon: React.ElementType;
  pill: string;
  bar: string;
  chip: string;
}> = {
  GUARD: {
    label: 'Guard',
    icon: Shield,
    pill: 'bg-accent-50 text-accent-700 ring-accent-200/70',
    bar: 'bg-accent-500',
    chip: 'from-accent-500 to-accent-600 ring-accent-200',
  },
  CLEANER: {
    label: 'Cleaner',
    icon: Sparkles,
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    bar: 'bg-emerald-500',
    chip: 'from-emerald-500 to-emerald-600 ring-emerald-200',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    icon: Wrench,
    pill: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    bar: 'bg-amber-500',
    chip: 'from-amber-500 to-amber-600 ring-amber-200',
  },
  OTHER: {
    label: 'Other',
    icon: HeartHandshake,
    pill: 'bg-gray-100 text-gray-600 ring-gray-200/70',
    bar: 'bg-gray-300',
    chip: 'from-gray-400 to-gray-500 ring-gray-200',
  },
};

const ROLE_LABELS: Record<StaffRole, string> = {
  GUARD: 'Guard',
  CLEANER: 'Cleaner',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

const FILTERS = ['ALL', 'ACTIVE', 'INACTIVE'] as const;
type ActiveFilter = (typeof FILTERS)[number];

export default function AdminStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<ActiveFilter>('ALL');
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

  const q = searchQuery.trim().toLowerCase();
  const filteredStaff = staff.filter((s) => {
    if (filterActive === 'ACTIVE' && !s.isActive) return false;
    if (filterActive === 'INACTIVE' && s.isActive) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.email ? s.email.toLowerCase().includes(q) : false) ||
      (s.phone ? s.phone.toLowerCase().includes(q) : false) ||
      ROLE_LABELS[s.role].toLowerCase().includes(q)
    );
  });

  const hasFilters = Boolean(q) || filterActive !== 'ALL';
  const clearFilters = () => { setSearchQuery(''); setFilterActive('ALL'); };

  const stats = {
    total: staff.length,
    active: staff.filter((s) => s.isActive).length,
    inactive: staff.filter((s) => !s.isActive).length,
    guards: staff.filter((s) => s.role === 'GUARD' && s.isActive).length,
  };

  const counts: Record<ActiveFilter, number> = {
    ALL: stats.total,
    ACTIVE: stats.active,
    INACTIVE: stats.inactive,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] text-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-500">Loading staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/admin')}
            aria-label="Back to dashboard"
            className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Staff</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Guards, cleaners and maintenance staff working in your society.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> Add staff
          </button>
        </div>

        {/* Banners */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 w-4 h-4 flex-shrink-0 text-red-600" />
            <p className="flex-1 text-body-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <CheckCircle2 className="mt-0.5 w-4 h-4 flex-shrink-0 text-emerald-600" />
            <p className="flex-1 text-body-sm text-emerald-700">{success}</p>
            <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stats */}
        {staff.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: Users, label: 'Total staff', value: stats.total, color: 'text-accent-600', bg: 'bg-accent-50' },
              { icon: CheckCircle2, label: 'Active', value: stats.active, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { icon: Power, label: 'Inactive', value: stats.inactive, color: 'text-amber-600', bg: 'bg-amber-50' },
              { icon: Shield, label: 'Active guards', value: stats.guards, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md"
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">{stat.label}</span>
                </div>
                <p className="text-display font-display text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search & filter */}
        {staff.length > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 lg:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, phone or role..."
                  aria-label="Search staff"
                  className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Show</span>
                {FILTERS.map((f) => {
                  const active = filterActive === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilterActive(f)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-body-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,1)]'
                          : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                      <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>
                        {counts[f]}
                      </span>
                    </button>
                  );
                })}
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-500 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Staff list */}
        {staff.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50">
              <Users className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No staff yet</h3>
            <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
              Add the people who keep the society running. Staff here are records for your roster, they do not get app logins.
            </p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <Plus className="w-4 h-4" /> Add staff
            </button>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Search className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="mb-2 text-title font-display text-gray-900">No staff match these filters</h3>
            <p className="mb-6 text-body-sm text-gray-500">
              {q ? `Nothing matched “${searchQuery.trim()}”. ` : ''}Try widening the active filter.
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
            {filteredStaff.map((s) => {
              const meta = ROLE_META[s.role] || ROLE_META.OTHER;
              const RoleIcon = meta.icon;
              return (
                <div
                  key={s.id}
                  className={`group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)] ${
                    s.isActive ? '' : 'bg-gray-50/60'
                  }`}
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.isActive ? meta.bar : 'bg-gray-300'} rounded-l-2xl transition-all duration-300 group-hover:w-1.5`} aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-4 py-5 pl-6 pr-5">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${s.isActive ? meta.chip : 'from-gray-300 to-gray-400 ring-gray-200'} ring-1 transition-transform duration-300 group-hover:scale-110`}>
                      <RoleIcon className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className={`text-title-sm font-display ${s.isActive ? 'text-gray-900' : 'text-gray-500'}`}>{s.name}</h3>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.pill}`}>
                          {meta.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                          s.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                            : 'bg-gray-100 text-gray-500 ring-gray-200/70'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {s.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {(s.email || s.phone) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {s.email && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                              <Mail className="w-3 h-3 text-gray-400" />
                              {s.email}
                            </span>
                          )}
                          {s.phone && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-caption-xs text-gray-500">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {s.phone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0">
                      <button
                        onClick={() => handleEdit(s)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-body-sm font-medium text-accent-700 transition-all hover:border-accent-300 hover:bg-accent-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-body-sm font-medium transition-all ${
                          s.isActive
                            ? 'border-gray-200 bg-white text-gray-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {s.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
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
      </main>

      {/* Add / Edit modal */}
      <Modal
        open={showForm}
        onClose={resetForm}
        icon={editingId ? Edit2 : Users}
        title={editingId ? 'Edit staff member' : 'Add staff member'}
        subtitle={editingId
          ? 'Update this person’s role or contact details.'
          : 'Keep your roster current. Staff records do not get app logins.'}
        size="md"
      >
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={fieldLabel} htmlFor="staff-name">Full name</label>
            <input
              id="staff-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Ahmed Khan"
              required
              maxLength={100}
              className={fieldInput}
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="staff-role">Role</label>
            <Select value={formRole} onChange={(e) => setFormRole(e.target.value as StaffRole)}>
              {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
            <p className="mt-2 text-caption-xs text-gray-400">
              Guards can be issued gate access from the Security gate page.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Contact</span>
              <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
              <span className="text-caption-xs text-gray-400">Optional</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel} htmlFor="staff-email">Email</label>
                <input
                  id="staff-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="ahmed@example.com"
                  maxLength={200}
                  className={fieldInput}
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="staff-phone">Phone</label>
                <input
                  id="staff-phone"
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  maxLength={20}
                  className={fieldInput}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[1.4] rounded-xl bg-accent-600 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Add staff member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
