'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, BarChart3, Folder, Wrench, CalendarRange,
  QrCode, Package, CreditCard, Bell, LogOut, Menu, X, Home, HelpCircle,
} from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import type { AuthResponse } from '@apartment/shared';

interface ResidentShellContextValue {
  user: AuthResponse | null;
  unreadNotices: number;
}

const ResidentShellContext = createContext<ResidentShellContextValue>({
  user: null,
  unreadNotices: 0,
});

export function useResidentShell() {
  return useContext(ResidentShellContext);
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
      { icon: LayoutDashboard, label: 'Home', href: '/dashboard/resident' },
    ],
  },
  {
    label: 'Community',
    items: [
      { icon: FileText, label: 'Notices', href: '/dashboard/resident/notices' },
      { icon: BarChart3, label: 'Polls', href: '/dashboard/resident/polls' },
      { icon: Folder, label: 'Documents', href: '/dashboard/resident/documents' },
    ],
  },
  {
    label: 'Services',
    items: [
      { icon: Wrench, label: 'Tickets', href: '/dashboard/resident/tickets' },
      { icon: CalendarRange, label: 'Amenities', href: '/dashboard/resident/amenities' },
      { icon: QrCode, label: 'Visitors', href: '/dashboard/resident/visitors' },
      { icon: Package, label: 'Packages', href: '/dashboard/resident/parcels' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { icon: CreditCard, label: 'Payments', href: '/dashboard/resident/invoices' },
    ],
  },
  {
    label: 'Support',
    items: [
      { icon: HelpCircle, label: 'FAQs', href: '/dashboard/resident/faqs' },
    ],
  },
];

// ── Sidebar Component ───────────────────────────────────────────────────
function ResidentSidebar({
  open,
  onClose,
  unreadNotices,
}: {
  open: boolean;
  onClose: () => void;
  unreadNotices: number;
}) {
  const router = useRouter();
  const currentPath = usePathname();

  const isItemActive = (item: NavItem) => {
    if (item.href === '/dashboard/resident') return currentPath === item.href;
    return currentPath === item.href || currentPath.startsWith(item.href + '/');
  };

  const handleNav = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-[70] flex h-full w-72 flex-col bg-gradient-to-b from-[#1e3a5f] via-[#1a3358] to-[#142847] transition-transform duration-300 ease-in-out lg:top-20 lg:h-[calc(100%-5rem)] lg:translate-x-0 ${
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
                  const badge = item.label === 'Notices' && unreadNotices > 0 ? `${unreadNotices}` : undefined;
                  const isActive = isItemActive(item);
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

// ── Resident Shell (persistent layout for all resident pages) ─────────
export function ResidentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentPath = usePathname();
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userData = await auth.me();
        const isResident = userData.memberships.some((m) => m.role === 'RESIDENT');
        if (!isResident) {
          router.push('/login');
          return;
        }
        if (cancelled) return;
        setUser(userData);

        // Unread-notice count for the header bell + sidebar badge
        try {
          const notices = await apiGet<any[]>('/api/v1/notices').catch(() => []);
          if (!cancelled) {
            setUnreadNotices(notices.filter((n: any) => !n.hasRead).length);
          }
        } catch { /* bell dot is best-effort */ }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.push('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await auth.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc]">
        <LoadingScreen label="Loading your community" hint="Fetching your unit, notices and dues." />
      </div>
    );
  }

  const society = user?.memberships[0];

  return (
    <ResidentShellContext.Provider value={{ user, unreadNotices }}>
      <div className="min-h-screen bg-white text-gray-900">
        <ResidentSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          unreadNotices={unreadNotices}
        />

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
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
                <p className="truncate text-body-sm font-semibold text-gray-900">{society?.societyName || 'My Community'}</p>
                <p className="text-caption-xs text-gray-500">Resident</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:block text-caption text-gray-700">{user?.user.name}</span>
              <button onClick={() => router.push('/dashboard/resident/notices')} className="relative p-2 rounded-lg transition-colors text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                <Bell className="w-4.5 h-4.5" />
                {unreadNotices > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white" />
                )}
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:text-status-danger hover:bg-gray-50">
                <LogOut className="w-4 h-4" />
                <span className="text-body-sm font-medium hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content. The canvas tint lives here so every resident page sits
            on the same ground instead of each page painting its own. */}
        <main className="min-h-[calc(100vh-5rem)] bg-[#f6f8fc] lg:ml-72">
          <div className="max-w-6xl mx-auto px-4 py-6 pb-24">{children}</div>
        </main>

        {/* ── Mobile bottom nav ───────────────────────────────────────── */}
        <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-gray-200 px-3 py-2 safe-area-bottom transition-opacity ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center justify-around">
            {[
              { icon: Home, label: 'Home', href: '/dashboard/resident' },
              { icon: Bell, label: 'Notices', href: '/dashboard/resident/notices' },
              { icon: Wrench, label: 'Tickets', href: '/dashboard/resident/tickets' },
              { icon: CreditCard, label: 'Payments', href: '/dashboard/resident/invoices' },
            ].map((item) => {
              const isActive = item.href === '/dashboard/resident'
                ? currentPath === item.href
                : currentPath.startsWith(item.href);
              return (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors ${
                    isActive ? 'bg-[#eff6ff]' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-accent-600' : ''}`} />
                  <span className={`text-caption-xs font-medium ${isActive ? 'text-accent-700' : ''}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </ResidentShellContext.Provider>
  );
}
