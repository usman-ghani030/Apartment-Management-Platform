'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Building2, Users, FileText, CreditCard, LogOut, Bell,
  CalendarRange, BarChart3, Folder, Clock, Home, UserPlus,
  QrCode, Scan, Menu, X, Package, Shield, PieChart, LayoutDashboard,
  Contact, AlertTriangle, HelpCircle, Landmark, BadgeCheck,
} from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
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
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Home', href: '/dashboard/admin' },
    ],
  },
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
      { icon: Contact, label: 'Staff', href: '/dashboard/admin/staff' },
      { icon: CalendarRange, label: 'Amenities', href: '/dashboard/admin/amenities' },
      { icon: AlertTriangle, label: 'SOS Alerts', href: '/dashboard/admin/sos-alerts' },
      { icon: FileText, label: 'Notices', href: '/dashboard/admin/notices' },
      { icon: QrCode, label: 'Visitors', href: '/dashboard/admin/visitors' },
      { icon: Scan, label: 'Security gate', href: '/dashboard/guard' },
    ],
  },
  {
    label: 'Finance & Records',
    items: [
      { icon: CreditCard, label: 'Invoices', href: '/dashboard/admin/invoices' },
      { icon: BadgeCheck, label: 'Payment proofs', href: '/dashboard/admin/payment-proofs' },
      { icon: Landmark, label: 'Platform billing', href: '/dashboard/admin/platform-billing' },
      { icon: BarChart3, label: 'Polls', href: '/dashboard/admin/polls' },
      { icon: Folder, label: 'Documents', href: '/dashboard/admin/documents' },
      { icon: Package, label: 'Packages', href: '/dashboard/admin/parcels' },
      { icon: Clock, label: 'Audit trail', href: '/dashboard/admin/audit-log' },
      { icon: PieChart, label: 'Analytics', href: '/dashboard/admin/analytics' },
    ],
  },
  {
    label: 'Support',
    items: [
      { icon: HelpCircle, label: 'FAQs', href: '/dashboard/admin/faqs' },
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
        <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-gradient-to-b from-[#1e3a5f] via-[#1a3358] to-[#142847] transition-transform duration-300 ease-in-out lg:top-20 lg:h-[calc(100%-5rem)] lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* The brand lives in the top bar now, so the rail starts straight into
            its nav. The close button is only needed for the mobile drawer. */}
        <div className="flex flex-shrink-0 items-center justify-between px-4 pt-4 lg:hidden">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Menu</span>
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="sidebar-blue-scroll flex-1 overflow-y-auto px-3 py-4 space-y-6 lg:py-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="flex items-center gap-2.5 px-2 mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  {section.label}
                </span>
                <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const badge = statBadges[item.label];
                  const isActive = currentPath === item.href;
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleNav(item.href)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative flex w-full items-center gap-3 pl-3.5 pr-2.5 py-2.5 rounded-xl text-body font-medium text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-0 ${
                        isActive
                          ? 'bg-white text-accent-700 shadow-[0_2px_10px_-2px_rgba(4,20,45,0.45)]'
                          : 'text-white hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {/* Active rail */}
                      <span
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-accent-600 transition-all duration-300 ${isActive ? 'h-5 opacity-100' : 'h-0 opacity-0'}`}
                        aria-hidden="true"
                      />
                      <item.icon className={`w-4.5 h-4.5 flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-accent-600' : 'text-white/60 group-hover:text-white'}`} />
                      <span className="flex-1 truncate transition-transform duration-200 group-hover:translate-x-0.5">
                        {item.label}
                      </span>
                      {badge && (
                        <span className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${
                          isActive
                            ? 'bg-accent-100 text-accent-700'
                            : 'bg-white/10 text-white/70 group-hover:bg-white/15 group-hover:text-white/90'
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
        <div className="flex-shrink-0 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" aria-hidden="true" />
            <span className="text-caption-xs font-medium text-white/50">OmniHome</span>
            <span className="ml-auto font-mono text-[11px] font-semibold tracking-[0.18em] text-white/30">v1.0</span>
          </div>
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
          router.push('/login');
          return;
        }
        if (cancelled) return;
        setUser(userData);
        // Unblock rendering as soon as auth resolves - inner pages load instantly,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await auth.logout();
    router.push('/login');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc]">
        <LoadingScreen label="Loading dashboard" hint="Checking your membership and society data." />
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
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-md">
          <div className="flex h-20 items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              {/* Hamburger for mobile */}
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                className="rounded-lg p-2 transition-colors hover:bg-gray-50 lg:hidden"
              >
                <Menu className="w-4.5 h-4.5 text-gray-700" />
              </button>

              {/* Brand - part of the top bar, matching the landing page navbar */}
              <button
                onClick={() => router.push('/')}
                title="Go to the OmniHome landing page"
                className="flex flex-shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
              >
                <img src="/logo3.png" alt="OmniHome" className="h-12 w-auto object-contain" />
                <span className="hidden text-title-sm font-display text-gray-900 sm:inline">
                  Omni<span className="text-accent-600">Home</span>
                </span>
              </button>

              <span className="mx-1 hidden h-9 w-px bg-gray-200 sm:block" aria-hidden="true" />

              {/* Society context */}
              <div className="hidden min-w-0 text-left md:block">
                <p className="truncate text-body-sm font-semibold text-gray-900">{society?.societyName || 'Dashboard'}</p>
                <p className="text-caption-xs text-gray-500">Committee Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:block text-caption text-gray-700">{user?.user.name}</span>
              <button onClick={() => router.push('/dashboard/admin/notices')} className="relative p-2 rounded-lg transition-colors text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white" />
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:text-status-danger hover:bg-gray-50">
                <LogOut className="w-4 h-4" />
                <span className="text-body-sm font-medium hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="lg:ml-72">{children}</main>
      </div>
    </AdminShellContext.Provider>
  );
}
