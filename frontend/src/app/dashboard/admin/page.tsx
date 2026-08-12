'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, FileText, CreditCard, LogOut, Bell, Shield,
  CalendarRange, BarChart3, Folder, Clock, Home, UserPlus, Ticket, Wrench,
  ChevronRight, Activity, QrCode, Scan, Menu, X, Package,
} from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';
import type { AuthResponse } from '@apartment/shared';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ── Types ─────────────────────────────────────────────────────────────
interface DashboardStats {
  units: number;
  residents: number;
  openTickets: number;
  totalTickets: number;
  pendingInvoices: number;
  pendingVisitors: number;
  activePolls: number;
  todayBookings: number;
}

interface RecentTicket {
  id: string;
  title: string;
  status: string;
  createdBy: { name: string };
  createdAt: string;
  unitNumber?: string;
}

// ── Sidebar nav item ──────────────────────────────────────────────────
interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Management',
    items: [
      { icon: Building2, label: 'Buildings', href: '/dashboard/admin/buildings' },
      { icon: Home, label: 'Units', href: '/dashboard/admin/units' },
      { icon: UserPlus, label: 'Residents', href: '/dashboard/admin/memberships' },
      { icon: Users, label: 'Directory', href: '/dashboard/admin/directory' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { icon: Shield, label: 'Maintenance', href: '/dashboard/admin/tickets' },
      { icon: CalendarRange, label: 'Amenities', href: '/dashboard/admin/amenities' },
      { icon: FileText, label: 'Notices', href: '/dashboard/admin/notices' },
      { icon: QrCode, label: 'Visitors', href: '/dashboard/admin/visitors' },
      { icon: Scan, label: 'Security gate', href: '/dashboard/guard' },
    ],
  },
  {
    label: 'Finance & Records',
    items: [
      { icon: CreditCard, label: 'Invoices', href: '/dashboard/admin/invoices' },
      { icon: BarChart3, label: 'Polls', href: '/dashboard/admin/polls' },
      { icon: Folder, label: 'Documents', href: '/dashboard/admin/documents' },
      { icon: Package, label: 'Packages', href: '/dashboard/admin/parcels' },
      { icon: Clock, label: 'Audit trail', href: '/dashboard/admin/audit-log' },
    ],
  },
];

// ── Sidebar Component ─────────────────────────────────────────────────
function Sidebar({
  open,
  onClose,
  stats,
  currentPath,
}: {
  open: boolean;
  onClose: () => void;
  stats: DashboardStats;
  currentPath: string;
}) {
  const router = useRouter();

  const statBadges: Record<string, string | undefined> = {
    Residents: stats.residents > 0 ? `${stats.residents}` : undefined,
    Units: stats.units > 0 ? `${stats.units}` : undefined,
    Maintenance: stats.openTickets > 0 ? `${stats.openTickets}` : undefined,
    Amenities: stats.todayBookings > 0 ? `${stats.todayBookings}` : undefined,
    Visitors: stats.pendingVisitors > 0 ? `${stats.pendingVisitors}` : undefined,
    Invoices: stats.pendingInvoices > 0 ? `${stats.pendingInvoices}` : undefined,
    Polls: stats.activePolls > 0 ? `${stats.activePolls}` : undefined,
  };

  const handleNav = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-gray-200 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-body-sm font-semibold text-gray-900">OmniHome</span>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-gray-50 lg:hidden">
            <X className="w-4 h-4 text-gray-700" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <span className="text-caption-xs font-semibold uppercase tracking-widest text-gray-400 block px-2 mb-2">
                {section.label}
              </span>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const badge = statBadges[item.label];
                  const isActive = currentPath === item.href;
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleNav(item.href)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-body-sm font-medium transition-all text-left focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:ring-offset-2 ${
                        isActive
                          ? 'bg-accent-50 text-accent-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-accent-600' : 'text-gray-700'}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge && (
                        <span className={`text-caption-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          isActive
                            ? 'bg-accent-100 text-accent-600'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-gray-200 px-3 py-3 flex-shrink-0">
          <span className="text-caption-xs text-gray-400 block px-2">OmniHome v1.0</span>
        </div>
      </aside>
    </>
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
  const [data, setData] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    units: 0, residents: 0, openTickets: 0, totalTickets: 0,
    pendingInvoices: 0, pendingVisitors: 0, activePolls: 0, todayBookings: 0,
  });
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);

  useEffect(() => {
    auth.me()
      .then(async (userData) => {
        const isAdmin = userData.memberships.some(
          (m) => m.role === 'COMMITTEE_ADMIN' || m.role === 'SUPER_ADMIN'
        );
        if (!isAdmin) {
          router.push('/dashboard/resident');
          return;
        }
        setData(userData);

        // Fetch dashboard data in parallel
        try {
          const [
            unitsRes, membershipsRes, ticketsRes,
            invoicesRes, visitorsRes, pollsRes, bookingsRes,
          ] = await Promise.all([
            apiGet<any[]>('/api/v1/units').catch(() => []),
            apiGet<any[]>('/api/v1/auth/memberships').catch(() => []),
            apiGet<any[]>('/api/v1/tickets').catch(() => []),
            apiGet<any[]>('/api/v1/invoices').catch(() => []),
            apiGet<any[]>('/api/v1/visitor-passes').catch(() => []),
            apiGet<any[]>('/api/v1/polls').catch(() => []),
            apiGet<any[]>('/api/v1/bookings').catch(() => []),
          ]);

          const residents = membershipsRes.filter(
            (m: any) => m.role === 'RESIDENT' && m.status === 'ACTIVE'
          ).length;

          const openTickets = ticketsRes.filter(
            (t: any) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)
          ).length;

          const pendingInvoices = invoicesRes.filter(
            (i: any) => i.status === 'PENDING' || i.status === 'OVERDUE'
          ).length;

          const pendingVisitors = visitorsRes.filter(
            (v: any) => v.status === 'PENDING'
          ).length;

          const activePolls = pollsRes.filter(
            (p: any) => p.status === 'ACTIVE'
          ).length;

          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayBookings = bookingsRes.filter(
            (b: any) => new Date(b.date || b.startTime) >= todayStart
          ).length;

          setStats({
            units: unitsRes.length,
            residents,
            openTickets,
            totalTickets: ticketsRes.length,
            pendingInvoices,
            pendingVisitors,
            activePolls,
            todayBookings,
          });

          // Recent tickets for the activity feed
          const recent = ticketsRes
            .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
            .slice(0, 5)
            .map((t: any) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              createdBy: t.createdBy || { name: 'Unknown' },
              createdAt: t.createdAt,
              unitNumber: t.unit?.unitNumber,
            }));
          setRecentTickets(recent);
        } catch (err) { console.error('[Dashboard] Failed to load stats:', err); }
      })
      .catch((err: ApiError) => {
        if (err.status === 401) router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await auth.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const society = data?.memberships[0];
  const firstName = data?.user.name?.split(' ')[0] || 'Admin';

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
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        stats={stats}
        currentPath="/dashboard/admin"
      />

      {/* ── Top Bar ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 lg:ml-64">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-50 transition-colors lg:hidden"
            >
              <Menu className="w-4.5 h-4.5 text-gray-700" />
            </button>
            <button onClick={() => router.push('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center shadow-sm">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-body-sm font-semibold text-gray-900">{society?.societyName || 'Dashboard'}</p>
                <p className="text-caption-xs text-gray-700">Committee Admin</p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:block text-caption text-gray-700">{data?.user.name}</span>
            <button onClick={() => router.push('/dashboard/admin/notices')} className="relative p-2 rounded-lg transition-colors text-gray-700 hover:text-gray-900 hover:bg-gray-50">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white" />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg transition-colors text-gray-700 hover:text-status-danger hover:bg-gray-50">
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="lg:ml-64 px-4 py-6 max-w-7xl">
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
      </main>
    </div>
  );
}

function today(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
