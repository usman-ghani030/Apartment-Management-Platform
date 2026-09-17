'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Users, Mail, User, Home, UserX, Shield, Wrench, Building2, UserPlus, Search, X, UserSearch } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Modal, fieldLabel, fieldInput } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { auth, ApiError, apiGet, apiPost } from '@/lib/api';
import { SuccessBanner, PasswordReveal } from '@/components/ui/banners';

/** Text fields that carry a leading icon need their own padding (pl-10). */
const inputWithIcon =
  'w-full bg-gray-50 border border-gray-200/80 rounded-xl pl-10 pr-4 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:outline-none focus:bg-white focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10';

const INVITE_ROLES = [
  { value: 'RESIDENT' as const, label: 'Resident', hint: 'Lives in a unit', icon: Home },
  { value: 'SECURITY_GUARD' as const, label: 'Guard', hint: 'Gate and visitors', icon: Shield },
  { value: 'VENDOR' as const, label: 'Vendor', hint: 'Service provider', icon: Wrench },
];

interface Member {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  unitId: string | null;
  unitNumber: string | null;
  status: string;
  createdAt: string;
}

interface Unit {
  id: string;
  unitNumber: string;
  buildingName: string;
}

export default function AdminMembershipsPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteUnitId, setInviteUnitId] = useState('');
  const [inviteRole, setInviteRole] = useState<'RESIDENT' | 'SECURITY_GUARD' | 'VENDOR'>('RESIDENT');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'COMMITTEE_ADMIN' | 'RESIDENT' | 'SECURITY_GUARD' | 'VENDOR'>('ALL');

  useEffect(() => {
    auth.me().catch(() => router.push('/login'));
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const [membersData, unitsData] = await Promise.all([
        apiGet<Member[]>('/api/v1/auth/memberships'),
        apiGet<Unit[]>('/api/v1/units'),
      ]);
      setMembers(membersData || []);
      setUnits(unitsData || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    // Residents must be attached to a unit (the unit picker is a custom
    // dropdown, so the browser cannot enforce this for us).
    if (inviteRole === 'RESIDENT' && !inviteUnitId) {
      setError('Pick the unit this resident belongs to');
      setSaving(false);
      return;
    }
    try {
      const body: any = { email: inviteEmail, name: inviteName, role: inviteRole };
      if (inviteRole === 'RESIDENT') body.unitId = inviteUnitId;
      const result = await apiPost<{ tempPassword?: string }>('/api/v1/auth/invite', body);
      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        setSuccess(`Invited ${inviteEmail} as ${inviteRole.replace(/_/g, ' ')}! Share the temporary password with them.`);
      } else {
        setTempPassword('');
        setSuccess(`Added ${inviteEmail} as ${inviteRole.replace(/_/g, ' ')}.`);
      }
      setInviteEmail(''); setInviteName(''); setInviteUnitId(''); setInviteRole('RESIDENT');
      setShowInviteForm(false);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (memberId: string, userName: string) => {
    if (!confirm(`Revoke membership for "${userName}"? This will also cancel all their visitor passes.`)) return;
    try {
      await apiPost(`/api/v1/auth/memberships/${memberId}/revoke`, {});
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert('Failed to revoke membership');
    }
  };

  if (loading) {
    return <PageSkeleton width="max-w-5xl" />;
  }

  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  const revokedMembers = members.filter((m) => m.status === 'REVOKED');
  const admins = activeMembers.filter((m) => m.role === 'COMMITTEE_ADMIN');
  const residents = activeMembers.filter((m) => m.role === 'RESIDENT');
  const guards = activeMembers.filter((m) => m.role === 'SECURITY_GUARD');

  // ── Search + role filter (client side, so the lists never empty the page) ──
  const q = query.trim().toLowerCase();
  const filtersActive = Boolean(q || roleFilter !== 'ALL');

  const matches = (m: Member) => {
    if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;
    if (!q) return true;
    const roleLabel = m.role.replace(/_/g, ' ').toLowerCase();
    return [m.userName, m.userEmail, m.unitNumber || '', roleLabel].some((v) =>
      v.toLowerCase().includes(q)
    );
  };

  const filteredActive = activeMembers.filter(matches);
  const filteredRevoked = revokedMembers.filter(matches);

  const ROLE_FILTERS: Array<{ value: typeof roleFilter; label: string; count: number }> = [
    { value: 'ALL', label: 'Everyone', count: activeMembers.length },
    { value: 'COMMITTEE_ADMIN', label: 'Admins', count: admins.length },
    { value: 'RESIDENT', label: 'Residents', count: residents.length },
    { value: 'SECURITY_GUARD', label: 'Guards', count: guards.length },
  ];

  const clearFilters = () => { setQuery(''); setRoleFilter('ALL'); };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Residents & Members</h1>
            <p className="text-body-sm text-gray-500 mt-0.5">Manage who has access to your society</p>
          </div>
          <button
            onClick={() => { setShowInviteForm(true); setError(''); setSuccess(''); }}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl px-4 py-2.5 text-body-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Invite Member
          </button>
        </div>

        {/* Success message */}
        {success && (
          <SuccessBanner>
            <p>{success}</p>
            {tempPassword && <PasswordReveal password={tempPassword} />}
          </SuccessBanner>
        )}

        {/* Invite Form Modal */}
        <Modal
          open={showInviteForm}
          onClose={() => { setShowInviteForm(false); setError(''); }}
          icon={UserPlus}
          title="Invite someone"
          subtitle="They receive a temporary password to sign in with. Only residents are tied to a unit."
          size="md"
        >
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
          )}
          <form onSubmit={handleInvite} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel} htmlFor="invite-name">Full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input id="invite-name" type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required className={inputWithIcon} placeholder="John Doe" />
                </div>
              </div>
              <div>
                <label className={fieldLabel} htmlFor="invite-email">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className={inputWithIcon} placeholder="john@example.com" />
                </div>
              </div>
            </div>

            {/* Role picker */}
            <div>
              <label className={fieldLabel}>Role</label>
              <div className="grid grid-cols-3 gap-2.5">
                {INVITE_ROLES.map((r) => {
                  const active = inviteRole === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setInviteRole(r.value)}
                      aria-pressed={active}
                      className={`rounded-2xl border p-3 text-left transition-all duration-200 ${
                        active
                          ? 'border-accent-300 bg-accent-50 ring-2 ring-accent-500/15'
                          : 'border-gray-200/80 bg-gray-50/70 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <r.icon className={`w-4 h-4 ${active ? 'text-accent-600' : 'text-gray-400'}`} />
                      <p className={`mt-2 text-body-sm font-medium ${active ? 'text-accent-700' : 'text-gray-700'}`}>{r.label}</p>
                      <p className="text-caption-xs text-gray-400">{r.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {inviteRole === 'RESIDENT' && (
              <div>
                <label className={fieldLabel} htmlFor="invite-unit">Assign unit</label>
                <Select value={inviteUnitId} onChange={(e) => setInviteUnitId(e.target.value)} required>
                  <option value="">Select unit...</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.buildingName} - {u.unitNumber}</option>)}
                </Select>
                <p className="mt-2 text-caption-xs text-gray-400">Residents can only belong to one unit at a time.</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowInviteForm(false); setError(''); }}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-body-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={saving}
                className="flex-[1.4] bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-body-sm font-medium flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]"
              >
                <UserPlus className="w-4 h-4" />
                {saving ? 'Inviting...' : 'Send invitation'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: 'Active', value: activeMembers.length, color: 'text-accent-600', bg: 'bg-accent-50' },
            { icon: User, label: 'Residents', value: residents.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: Shield, label: 'Guards', value: guards.length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { icon: Building2, label: 'Units', value: units.length, color: 'text-purple-600', bg: 'bg-purple-50' },
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

        {/* Search + role filter */}
        <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, unit, or role..."
              aria-label="Search members"
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

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Role</span>
            {ROLE_FILTERS.map((f) => {
              const active = roleFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setRoleFilter(f.value)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-body-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,1)]'
                      : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {f.label}
                  <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-body-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Active Members */}
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-title-sm font-display text-gray-900">Active Members</h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 ring-1 ring-accent-200/60">{filteredActive.length}</span>
          {filtersActive && activeMembers.length !== filteredActive.length && (
            <span className="text-caption-xs text-gray-400">of {activeMembers.length}</span>
          )}
        </div>

        {filteredActive.length === 0 ? (
          filtersActive ? (
            <div className="mb-8 rounded-2xl border border-gray-200/80 bg-white p-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
                <UserSearch className="h-6 w-6 text-accent-500" />
              </div>
              <h3 className="mb-2 text-title font-display text-gray-900">No members matched</h3>
              <p className="mx-auto mb-6 max-w-sm text-body-sm text-gray-500">
                Nothing matches the current search or role filter. Try another spelling, or clear the filters.
              </p>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
              >
                <X className="h-4 w-4" /> Clear filters
              </button>
            </div>
          ) : (
          <div className="bg-white border border-gray-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-16 text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto mb-5">
              <Users className="w-7 h-7 text-accent-500" />
            </div>
            <h3 className="text-title font-display text-gray-900 mb-2">No members yet</h3>
            <p className="text-body-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Invite residents, security guards, and vendors to your society.
            </p>
            <button
              onClick={() => { setShowInviteForm(true); setError(''); setSuccess(''); }}
              className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl px-5 py-2.5 text-body-sm font-medium shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Invite Member
            </button>
          </div>
          )
        ) : (
          <div className="space-y-3 mb-10">
            {filteredActive.map((m) => {
              const isAdmin = m.role === 'COMMITTEE_ADMIN';
              const isGuard = m.role === 'SECURITY_GUARD';
              const roleLabel = isAdmin ? 'Admin' : isGuard ? 'Guard' : 'Resident';
              // The role is the one coloured value on the row; the rest of the
              // card stays on the single blue accent.
              const roleText = isAdmin ? 'text-purple-700' : isGuard ? 'text-amber-700' : 'text-emerald-700';
              const joined = new Date(m.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={m.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent-500 transition-all duration-300 group-hover:w-1.5" aria-hidden="true" />

                  <div className="flex flex-wrap items-center gap-x-7 gap-y-5 pl-6 pr-5 py-5">
                    <button
                      onClick={() => router.push(`/dashboard/admin/directory/${m.userId}`)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-none"
                    >
                      <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_10px_24px_-12px_rgba(37,99,235,1)]">
                        <User className="h-5 w-5 text-white" />
                        <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Member</span>
                          {m.status !== 'ACTIVE' && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500 ring-1 ring-gray-200/60">
                              Revoked
                            </span>
                          )}
                        </div>
                        <h3 className="mt-0.5 truncate text-title-sm font-display text-gray-900 transition-colors group-hover:text-accent-700">
                          {m.userName}
                        </h3>
                        <p className="truncate text-caption-xs text-gray-500">{m.userEmail}</p>
                      </div>
                    </button>

                    {/* Labelled detail */}
                    <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3.5 sm:w-auto sm:flex-[1.5] sm:grid-cols-4">
                      <Field label="Unit">{m.unitNumber || 'Not assigned'}</Field>
                      <Field label="Role">
                        <span className={roleText}>{roleLabel}</span>
                      </Field>
                      <Field label="Status">{m.status === 'ACTIVE' ? 'Active' : 'Revoked'}</Field>
                      <Field label="Member since">{joined}</Field>
                    </div>

                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-shrink-0">
                      <button
                        onClick={() => handleRevoke(m.id, m.userName)}
                        title="Revoke membership"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <UserX className="w-3.5 h-3.5" /> Revoke
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Revoked Members */}
        {filteredRevoked.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-title-sm font-display text-gray-500">Revoked</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ring-1 ring-gray-200/60">{filteredRevoked.length}</span>
            </div>
            <div className="space-y-2">
              {filteredRevoked.map((m) => (
                <div key={m.id} className="group relative bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden opacity-50">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 rounded-l-2xl" />
                  <div className="flex items-center gap-5 pl-6 pr-5 py-4">
                    <div className="w-10 h-10 rounded-2xl bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4.5 h-4.5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-body font-medium text-gray-500 truncate">{m.userName}</h3>
                      <p className="text-caption-xs text-gray-400 truncate">{m.userEmail}{m.unitNumber ? ` · ${m.unitNumber}` : ''}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ring-1 ring-gray-200/60">Revoked</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
