'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Wrench, CreditCard, CalendarRange,
  QrCode, BarChart3, Folder, Ticket, Clock, ChevronRight,
  User, Package,
} from 'lucide-react';
import { ApiError, apiGet } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResidentShell } from '@/components/dashboard/resident-shell';

// ── Types ─────────────────────────────────────────────────────────────
interface DashboardData {
  unreadNotices: number;
  openTickets: number;
  pendingInvoices: { count: number; overdue: boolean };
  pendingVisitors: number;
  activePolls: number;
  recentActivity: Array<{ type: string; title: string; time: string; status?: string }>;
}

// ── Quick Action Item ─────────────────────────────────────────────────
function QuickActionBtn({
  icon: Icon,
  label,
  onClick,
  badge,
  urgent = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: number;
  urgent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-2.5 p-4.5 rounded-xl bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-200 hover:border-accent-300 hover:shadow-md group w-full"
    >
      {badge && badge > 0 ? (
        <span className={`absolute -top-1.5 -right-1.5 w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white ${
          urgent ? 'bg-status-danger text-white' : 'bg-accent-600 text-white'
        }`}>
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200 ${
        urgent ? 'bg-status-danger/10 text-status-danger' : 'bg-accent-50 text-accent-600  '
      }`}>
        <Icon className="w-5.5 h-5.5" />
      </div>
      <span className="text-caption-xs font-medium text-gray-700 group-hover:text-gray-900 transition-colors leading-tight text-center">{label}</span>
    </button>
  );
}

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

// ── Resident Dashboard ─────────────────────────────────────────────────
export default function ResidentDashboard() {
  const router = useRouter();
  const { user } = useResidentShell();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData>({
    unreadNotices: 0, openTickets: 0, pendingInvoices: { count: 0, overdue: false },
    pendingVisitors: 0, activePolls: 0, recentActivity: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [notices, tickets, invoices, visitors, polls] = await Promise.all([
          apiGet<any[]>('/api/v1/notices').catch(() => []),
          apiGet<any[]>('/api/v1/tickets').catch(() => []),
          apiGet<any[]>('/api/v1/invoices').catch(() => []),
          apiGet<any[]>('/api/v1/visitor-passes').catch(() => []),
          apiGet<any[]>('/api/v1/polls').catch(() => []),
        ]);
        if (cancelled) return;

        const unreadNotices = notices.filter((n: any) => !n.hasRead).length;
        const openTickets = tickets.filter((t: any) =>
          ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)
        ).length;
        const pendingInvoices = invoices.filter((i: any) => i.status === 'PENDING' || i.status === 'OVERDUE');
        const pendingVisitors = visitors.filter((v: any) => v.status === 'PENDING').length;
        const activePolls = polls.filter((p: any) => p.status === 'ACTIVE').length;

        // Build recent activity
        const allActivity: Array<{ type: string; title: string; time: string; status?: string }> = [];
        tickets.slice(0, 5).forEach((t: any) => allActivity.push({ type: 'ticket', title: t.title, time: t.updatedAt || t.createdAt, status: t.status }));
        notices.slice(0, 3).forEach((n: any) => allActivity.push({ type: 'notice', title: n.title, time: n.createdAt }));
        invoices.filter((i: any) => i.status === 'PAID').slice(0, 3).forEach((i: any) => allActivity.push({ type: 'payment', title: `Payment for ${i.month || 'dues'}`, time: i.updatedAt || i.createdAt }));
        allActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        const recentActivity = allActivity.slice(0, 10);

        setDashboard({
          unreadNotices,
          openTickets,
          pendingInvoices: { count: pendingInvoices.length, overdue: pendingInvoices.some((i: any) => i.status === 'OVERDUE') },
          pendingVisitors,
          activePolls,
          recentActivity,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.push('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-700">Loading your community...</p>
        </div>
      </div>
    );
  }

  const firstName = user?.user.name?.split(' ')[0] || 'there';

  // Build attention items from actual data
  const attentionItems = [
    dashboard.pendingInvoices.count > 0 && {
      icon: CreditCard,
      label: dashboard.pendingInvoices.overdue
        ? `${dashboard.pendingInvoices.count} overdue dues`
        : `${dashboard.pendingInvoices.count} pending due${dashboard.pendingInvoices.count > 1 ? 's' : ''}`,
      href: '/dashboard/resident/invoices',
      urgent: dashboard.pendingInvoices.overdue,
    },
    dashboard.openTickets > 0 && {
      icon: Ticket,
      label: `${dashboard.openTickets} open ticket${dashboard.openTickets > 1 ? 's' : ''} need${dashboard.openTickets > 1 ? '' : 's'} attention`,
      href: '/dashboard/resident/tickets',
      urgent: true,
    },
    dashboard.pendingVisitors > 0 && {
      icon: QrCode,
      label: `${dashboard.pendingVisitors} pending visitor pass${dashboard.pendingVisitors > 1 ? 'es' : ''}`,
      href: '/dashboard/resident/visitors',
      urgent: false,
    },
    dashboard.unreadNotices > 0 && {
      icon: FileText,
      label: `${dashboard.unreadNotices} unread notice${dashboard.unreadNotices > 1 ? 's' : ''}`,
      href: '/dashboard/resident/notices',
      urgent: false,
    },
  ].filter(Boolean);

  const activityIconMap: Record<string, React.ElementType> = {
    ticket: Wrench,
    notice: FileText,
    payment: CreditCard,
  };

  const statusVariant = (s?: string) => {
    if (!s) return 'neutral' as const;
    if (s === 'OPEN' || s === 'ASSIGNED') return 'warning' as const;
    if (s === 'IN_PROGRESS') return 'info' as const;
    if (s === 'RESOLVED' || s === 'CLOSED' || s === 'PAID') return 'success' as const;
    return 'neutral' as const;
  };

  const hasAttentionItems = attentionItems.length > 0;

  return (
    <>
      {/* ── Welcome Section ───────────────────────────────────────── */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center">
            <User className="w-4.5 h-4.5 text-accent-600 " />
          </div>
          <div>
            <h1 className="text-display-sm text-gray-900">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}</h1>
            <p className="text-body-sm text-gray-700">
              {hasAttentionItems
                ? `${attentionItems.length} thing${attentionItems.length > 1 ? 's' : ''} need${attentionItems.length === 1 ? 's' : ''} your attention`
                : 'Everything looks good today'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Attention Items ───────────────────────────────────────── */}
      {hasAttentionItems && (
        <div className="mb-8 space-y-2 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          {attentionItems.map((item, i) => {
            if (!item) return null;
            const borderColor = item.urgent ? 'border-l-status-danger' : 'border-l-accent-500';
            const dotColor = item.urgent ? 'bg-status-danger' : 'bg-accent-500';
            return (
              <button
                key={i}
                onClick={() => router.push(item.href)}
                className={`w-full bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-between p-3.5 border-l-2 ${borderColor} hover:border-t-gray-200 hover:border-r-gray-200 hover:border-b-gray-200 hover:shadow-md transition-all`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
                  <item.icon className={`w-4.5 h-4.5 ${item.urgent ? 'text-status-danger' : 'text-accent-600 '} flex-shrink-0`} />
                  <span className="text-body-sm font-medium text-gray-900">{item.label}</span>
                </div>
                <div className="flex items-center gap-1 text-caption-xs font-medium text-accent-600  flex-shrink-0">
                  {item.urgent ? 'Resolve' : 'View'}
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <section className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-title-sm text-gray-900">Quick actions</h2>
          <span className="text-caption-xs text-gray-700">
            {dashboard.openTickets + dashboard.pendingInvoices.count + dashboard.pendingVisitors + dashboard.unreadNotices} pending
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          <QuickActionBtn icon={Wrench} label="Raise ticket" onClick={() => router.push('/dashboard/resident/tickets')} badge={dashboard.openTickets} urgent />
          <QuickActionBtn icon={CreditCard} label="Pay dues" onClick={() => router.push('/dashboard/resident/invoices')} badge={dashboard.pendingInvoices.count} urgent={dashboard.pendingInvoices.overdue} />
          <QuickActionBtn icon={CalendarRange} label="Book amenity" onClick={() => router.push('/dashboard/resident/amenities')} />
          <QuickActionBtn icon={QrCode} label="Visitor pass" onClick={() => router.push('/dashboard/resident/visitors')} badge={dashboard.pendingVisitors} />
          <QuickActionBtn icon={FileText} label="Notices" onClick={() => router.push('/dashboard/resident/notices')} badge={dashboard.unreadNotices} />
          <QuickActionBtn icon={BarChart3} label="Vote" onClick={() => router.push('/dashboard/resident/polls')} badge={dashboard.activePolls} />
          <QuickActionBtn icon={Folder} label="Documents" onClick={() => router.push('/dashboard/resident/documents')} />
          <QuickActionBtn icon={Package} label="Packages" onClick={() => router.push('/dashboard/resident/parcels')} />
        </div>
      </section>

      {/* ── Summary stats + Activity ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        {/* Stats row as summary cards */}
        <div className="lg:col-span-1 grid grid-cols-2 gap-3">
          {[
            { label: 'Open tickets', value: dashboard.openTickets, urgent: dashboard.openTickets > 0 },
            { label: 'Unread notices', value: dashboard.unreadNotices, urgent: dashboard.unreadNotices > 0 },
            { label: 'Pending dues', value: dashboard.pendingInvoices.count, urgent: dashboard.pendingInvoices.overdue },
            { label: 'Active polls', value: dashboard.activePolls, urgent: false },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl shadow-sm p-3.5">
              <p className="text-caption-xs text-gray-700 mb-1">{s.label}</p>
              <p className={`text-display-sm font-bold ${s.urgent ? 'text-status-danger' : 'text-gray-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-title-sm text-gray-900">Recent activity</h2>
          </div>
          <Card variant="elevated" className="overflow-hidden">
            {dashboard.recentActivity.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {dashboard.recentActivity.map((activity, i) => {
                  const Icon = activityIconMap[activity.type] || Clock;
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'ticket' ? 'bg-status-warning/10 text-status-warning' :
                        activity.type === 'payment' ? 'bg-status-success/10 text-status-success' :
                        'bg-accent-50 text-accent-600 '
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-medium text-gray-900 truncate">{activity.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-caption-xs text-gray-700 capitalize">{activity.type}</span>
                          <span className="text-caption-xs text-gray-700">·</span>
                          <span className="text-caption-xs text-gray-700">{timeAgo(activity.time)}</span>
                        </div>
                      </div>
                      {activity.status && (
                        <StatusBadge variant={statusVariant(activity.status)} dot={false}>
                          {activity.status.replace(/_/g, ' ')}
                        </StatusBadge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                title="No recent activity"
                description="Your community updates, ticket status changes, and payments will show up here."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
