'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, FileText, CreditCard, Shield,
  CalendarRange, UserPlus, Ticket, Wrench, ChevronRight, Activity, QrCode,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAdminShell } from '@/components/dashboard/admin-shell';

// ── Time helper ───────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Summary Stat Card ─────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  icon: Icon,
  onClick,
  urgent = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  onClick?: () => void;
  urgent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl shadow-sm p-4 transition-all duration-200 hover:shadow-md hover:border-accent-300 text-left w-full ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption-xs font-medium text-gray-700">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${urgent ? 'bg-status-danger/10' : 'bg-accent-50'}`}>
          <Icon className={`w-4.5 h-4.5 ${urgent ? 'text-status-danger' : 'text-accent-600'}`} />
        </div>
      </div>
      <p className={`text-display-sm font-bold ${urgent ? 'text-status-danger' : 'text-gray-900'} mb-0.5`}>{value}</p>
      <div className="mt-1 h-1 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${urgent ? 'bg-status-danger/30' : 'bg-accent-500/20'}`} style={{ width: '100%' }} />
      </div>
    </button>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { user, stats, recentTickets, statsLoading } = useAdminShell();

  if (statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const firstName = user?.user.name?.split(' ')[0] || 'Admin';

  const statusVariant = (s: string) => {
    if (s === 'OPEN' || s === 'ASSIGNED') return 'warning' as const;
    if (s === 'IN_PROGRESS') return 'info' as const;
    if (s === 'RESOLVED' || s === 'CLOSED') return 'success' as const;
    return 'neutral' as const;
  };

  // Build attention items
  const attentionItems: Array<{
    icon: React.ElementType;
    title: string;
    subtitle: string;
    href: string;
    urgent: boolean;
    category: string;
  }> = [];

  if (stats.openTickets > 0) {
    attentionItems.push({
      icon: Ticket,
      title: `${stats.openTickets} open ticket${stats.openTickets > 1 ? 's' : ''}`,
      subtitle: 'Residents waiting for resolution',
      href: '/dashboard/admin/tickets',
      urgent: true,
      category: 'Maintenance',
    });
  }
  if (stats.pendingVisitors > 0) {
    attentionItems.push({
      icon: QrCode,
      title: `${stats.pendingVisitors} pending visitor pass${stats.pendingVisitors > 1 ? 'es' : ''}`,
      subtitle: 'Awaiting approval',
      href: '/dashboard/admin/visitors',
      urgent: false,
      category: 'Security',
    });
  }
  if (stats.pendingInvoices > 0) {
    attentionItems.push({
      icon: CreditCard,
      title: `${stats.pendingInvoices} pending due${stats.pendingInvoices > 1 ? 's' : ''}`,
      subtitle: 'Unpaid invoices need follow-up',
      href: '/dashboard/admin/invoices',
      urgent: true,
      category: 'Finance',
    });
  }

  return (
    <div className="px-4 py-6 max-w-7xl">
      {/* ── Welcome ───────────────────────────────────────────────── */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center">
            <Activity className="w-4.5 h-4.5 text-accent-600" />
          </div>
          <div>
            <h1 className="text-display-sm text-gray-900">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}</h1>
            <p className="text-body-sm text-gray-700">
              {stats.residents} active residents across {stats.units} units · {today()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <SummaryCard label="Total units" value={stats.units} icon={Building2} onClick={() => router.push('/dashboard/admin/units')} />
        <SummaryCard label="Active residents" value={stats.residents} icon={Users} onClick={() => router.push('/dashboard/admin/memberships')} />
        <SummaryCard label="Open tickets" value={stats.openTickets} icon={Ticket} onClick={() => router.push('/dashboard/admin/tickets')} urgent={stats.openTickets > 0} />
        <SummaryCard label="Pending dues" value={stats.pendingInvoices} icon={CreditCard} onClick={() => router.push('/dashboard/admin/invoices')} urgent={stats.pendingInvoices > 0} />
      </div>

      {/* ── Main Grid: Attention + Recent Tickets ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {/* Left: Needs your attention */}
        <div className="lg:col-span-2">
          <h2 className="text-title-sm text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent-600" />
            Needs your attention
            {attentionItems.length > 0 && (
              <span className="text-caption-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                {attentionItems.length} item{attentionItems.length > 1 ? 's' : ''}
              </span>
            )}
          </h2>

          {attentionItems.length > 0 ? (
            <div className="space-y-3">
              {attentionItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => router.push(item.href)}
                  className={`w-full bg-white border rounded-xl shadow-sm p-4 flex items-center gap-4 text-left hover:shadow-md transition-all ${
                    item.urgent
                      ? 'border-l-4 border-l-status-danger border-gray-200 hover:border-gray-200 hover:border-l-status-danger'
                      : 'border-l-4 border-l-accent-500 border-gray-200 hover:border-gray-200 hover:border-l-accent-500'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.urgent ? 'bg-status-danger/10' : 'bg-accent-50'
                  }`}>
                    <item.icon className={`w-5 h-5 ${item.urgent ? 'text-status-danger' : 'text-accent-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-caption text-gray-700 mt-0.5">{item.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-caption-xs text-gray-700 bg-gray-50 px-2 py-0.5 rounded">{item.category}</span>
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-body font-semibold text-gray-900">Everything looks good</p>
              <p className="text-caption text-gray-700 mt-1">No pending items need your attention right now</p>
            </div>
          )}

          {/* Quick links row */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: Shield, label: 'New ticket', href: '/dashboard/admin/tickets' },
              { icon: FileText, label: 'Post notice', href: '/dashboard/admin/notices' },
              { icon: UserPlus, label: 'Invite resident', href: '/dashboard/admin/memberships' },
              { icon: CalendarRange, label: 'Manage amenities', href: '/dashboard/admin/amenities' },
            ].map((link) => (
              <button
                key={link.label}
                onClick={() => router.push(link.href)}
                className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-3 text-caption-xs font-medium text-gray-700 hover:border-accent-300 hover:text-accent-600 hover:shadow-sm transition-all"
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Recent Tickets */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title-sm text-gray-900">Recent tickets</h2>
            <button
              onClick={() => router.push('/dashboard/admin/tickets')}
              className="text-caption-xs font-medium text-accent-600 hover:underline"
            >
              View all
            </button>
          </div>
          <Card variant="elevated" className="overflow-hidden">
            {recentTickets.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => router.push(`/dashboard/admin/tickets?id=${ticket.id}`)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      ['OPEN', 'ASSIGNED'].includes(ticket.status) ? 'bg-status-warning/10 text-status-warning' :
                      ticket.status === 'IN_PROGRESS' ? 'bg-status-info/10 text-status-info' :
                      'bg-status-success/10 text-status-success'
                    }`}>
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-caption-xs text-gray-700">{ticket.createdBy.name}</span>
                        {ticket.unitNumber && (
                          <>
                            <span className="text-caption-xs text-gray-700">·</span>
                            <span className="text-caption-xs text-gray-700">Unit {ticket.unitNumber}</span>
                          </>
                        )}
                        <span className="text-caption-xs text-gray-700">·</span>
                        <span className="text-caption-xs text-gray-700">{timeAgo(ticket.createdAt)}</span>
                      </div>
                    </div>
                    <StatusBadge variant={statusVariant(ticket.status)} dot={false}>
                      {ticket.status.replace(/_/g, ' ')}
                    </StatusBadge>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 px-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                  <Ticket className="w-5 h-5 text-gray-700" />
                </div>
                <p className="text-body-sm text-gray-700">No recent tickets</p>
                <p className="text-caption text-gray-700 mt-1">Tickets will appear here as residents submit them</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function today(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
