'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Users, X, Mail, User, Home, UserX, Shield, Wrench } from 'lucide-react';
import { auth, ApiError, apiGet, apiPost } from '@/lib/api';

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
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  const revokedMembers = members.filter((m) => m.status === 'REVOKED');

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin')} className="p-2 btn-ghost rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Residents & Members</h1>
            <p className="text-sm text-gray-700 mt-1">Manage who has access to your society</p>
          </div>
          <button
            onClick={() => { setShowInviteForm(true); setError(''); setSuccess(''); }}
            className="ml-auto btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Invite Resident
          </button>
        </div>

        {/* Success message */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3 mb-6">
            <p>{success}</p>
            {tempPassword && (
              <div className="mt-3 bg-green-500/20 rounded-lg p-3 flex items-center gap-2">
                <span className="text-xs text-green-300">Temporary Password:</span>
                <code className="text-sm font-mono bg-black/30 px-2 py-1 rounded text-green-200 select-all">{tempPassword}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(tempPassword); }}
                  className="ml-auto text-xs text-green-300 hover:text-green-200 underline"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}

        {/* Invite Form Modal */}
        {showInviteForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white border border-gray-200 rounded-xl shadow-md rounded-2xl p-8 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Invite Member</h2>
                <button onClick={() => { setShowInviteForm(false); setError(''); }} className="p-1 btn-ghost rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
                    <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="John Doe" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 pl-10 pr-4 focus:outline-none focus:border-accent-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
                    <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 pl-10 pr-4 focus:outline-none focus:border-accent-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                  <div className="relative">
                    {inviteRole === 'RESIDENT' && <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />}
                    {inviteRole === 'SECURITY_GUARD' && <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />}
                    {inviteRole === 'VENDOR' && <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />}
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 pl-10 pr-4 appearance-none focus:outline-none focus:border-accent-500/50">
                      <option value="RESIDENT">Resident</option>
                      <option value="SECURITY_GUARD">Security Guard</option>
                      <option value="VENDOR">Vendor</option>
                    </select>
                  </div>
                </div>
                {inviteRole === 'RESIDENT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Unit</label>
                    <div className="relative">
                      <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
                      <select value={inviteUnitId} onChange={(e) => setInviteUnitId(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 pl-10 pr-4 appearance-none focus:outline-none focus:border-accent-500/50">
                        <option value="">Select unit...</option>
                        {units.map((u) => <option key={u.id} value={u.id}>{u.buildingName} - {u.unitNumber}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={saving} className="w-full btn-primary justify-center">
                  {saving ? 'Inviting...' : 'Send Invitation'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold text-accent-500">{activeMembers.length}</p>
            <p className="text-xs text-gray-700">Active Residents</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-700">{units.length}</p>
            <p className="text-xs text-gray-700">Total Units</p>
          </div>
        </div>

        {/* Active Members */}
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-accent-500" /> Active Members ({activeMembers.length})
        </h2>

        {activeMembers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center mb-8">
            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No residents yet</p>
            <p className="text-sm text-gray-700 mt-1">Invite residents to your society</p>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {activeMembers.map((m) => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-accent-500/30 transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-accent-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{m.userName}</h3>
                    <p className="text-xs text-gray-700">{m.userEmail}{m.unitNumber ? ` · ${m.unitNumber}` : ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    m.role === 'COMMITTEE_ADMIN' ? 'border-accent-500/30 text-accent-500 bg-accent-50' :
                    'border-accent-500/30 text-accent-600 bg-accent-50'
                  }`}>
                    {m.role === 'COMMITTEE_ADMIN' ? 'Admin' : m.role === 'RESIDENT' ? 'Resident' : m.role}
                  </span>
                </div>
                <button
                  onClick={() => handleRevoke(m.id, m.userName)}
                  className="p-2 btn-ghost rounded-lg hover:text-red-500"
                  title="Revoke membership"
                >
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Revoked Members */}
        {revokedMembers.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Revoked ({revokedMembers.length})</h2>
            <div className="space-y-2">
              {revokedMembers.map((m) => (
                <div key={m.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-gray-700">{m.userName}</h3>
                      <p className="text-xs text-gray-700">{m.userEmail}{m.unitNumber ? ` · ${m.unitNumber}` : ''}</p>
                    </div>
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
