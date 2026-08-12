'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Building2, Users, FileText, CreditCard, LogOut, Bell,
  CalendarRange, BarChart3, Folder, Clock, Home, UserPlus,
  QrCode, Scan, Menu, X, Package, Shield,
} from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';
import type { AuthResponse } from '@apartment/shared';

// ── Shared types ─────────────────────────────────────────────────────────
export interface AdminStats {
  units: number;
  residents: number;
  openTickets: number;
  totalTickets: number;
  pendingInvoices: number;
  pendingVisitors: number;
  activePolls: number;
  todayBookings: number;
}

export interface RecentTicket {
  id: string;
  title: string;
  status: string;
  createdBy: { name: string };
  createdAt: string;
  unitNumber?: string;
}

interface AdminShellContextValue {
  user: AuthResponse | null;
  stats: AdminStats;
  recentTickets: RecentTicket[];
  statsLoading: boolean;
}

const AdminShellContext = createContext<AdminShellContextValue>({
  user: null,
  stats: {
    units: 0, residents: 0, openTickets: 0, totalTickets: 0,
    pendingInvoices: 0, pendingVisitors: 0, activePolls: 0, todayBookings: 0,
  },
  recentTickets: [],
  statsLoading: true,
});

export function useAdminShell() {
  return useContext(AdminShellContext);
}

// ── Sidebar nav config ──────────────────────────────────────────────────
interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
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

// ── Sidebar Component ───────────────────────────────────────────────────
function AdminSidebar({
  open,
  onClose,
  stats,
}: {
  open: boolean;
  onClose: () => void;
  stats: AdminStats;
}) {
  const router = useRouter();
  const currentPath = usePathname();

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

// ── Admin Shell (persistent layout for all admin pages) ────────────────
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    units: 0, residents: 0, openTickets: 0, totalTickets: 0,
    pendingInvoices: 0, pendingVisitors: 0, activePolls: 0, todayBookings: 0,
  });
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userData = await auth.me();
        const isAdmin = userData.memberships.some(
          (m) => m.role === 'COMMITTEE_ADMIN' || m.role === 'SUPER_ADMIN'
        );
        if (!isAdmin) {
          router.push('/dashboard/resident');
          return;
        }
        if (cancelled) return;
        setUser(userData);
        // Unblock rendering as soon as auth resolves — inner pages load instantly,
        // sidebar badges populate as soon as the stats fetch below settles.
        setAuthLoading(false);

        // Fetch dashboard stats in parallel (shared by sidebar badges + dashboard page)
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

          if (!cancelled) {
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
            setRecentTickets(recent);
          }
        } catch (err) { console.error('[Dashboard] Failed to load stats:', err); }
        finally { if (!cancelled) setStatsLoading(false); }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.push('/login');
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
          setStatsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleLogout = async () => {
    await auth.logout();
    router.push('/login');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const society = user?.memberships[0];

  return (
    <AdminShellContext.Provider value={{ user, stats, recentTickets, statsLoading }}>
      <div className="min-h-screen bg-white text-gray-900">
        <AdminSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          stats={stats}
        />

        {/* Top Bar */}
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
              <span className="hidden sm:block text-caption text-gray-700">{user?.user.name}</span>
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

        {/* Main Content */}
        <main className="lg:ml-64">{children}</main>
      </div>
    </AdminShellContext.Provider>
  );
}
