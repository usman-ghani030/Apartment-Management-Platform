'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Shield, Scan, Package, Clock, LayoutDashboard, Menu, X, LogOut, HelpCircle,
} from 'lucide-react';
import { auth, ApiError } from '@/lib/api';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import type { AuthResponse } from '@apartment/shared';

// ── Sidebar nav config ──────────────────────────────────────────────────
interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Security',
    items: [
      { icon: Scan, label: 'Scan QR', href: '/dashboard/guard' },
      { icon: Package, label: 'Packages', href: '/dashboard/guard/parcels' },
      { icon: Clock, label: 'Recent Activity', href: '/dashboard/guard/activity' },
    ],
  },
  {
    label: 'Support',
    items: [
      { icon: HelpCircle, label: 'FAQs', href: '/dashboard/guard/faqs' },
    ],
  },
];

// ── Sidebar Component ───────────────────────────────────────────────────
function GuardSidebar({
  open,
  onClose,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const currentPath = usePathname();

  const isItemActive = (item: NavItem) => {
    if (item.href === '/dashboard/guard') return currentPath === item.href;
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
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Admin dashboard shortcut - only for committee/super admins */}
          {isAdmin && (
            <div>
              <div className="flex items-center gap-2.5 px-2 mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  Dashboards
                </span>
                <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => handleNav('/dashboard/admin')}
                  aria-current={currentPath.startsWith('/dashboard/admin') ? 'page' : undefined}
                  className={`group relative flex w-full items-center gap-3 pl-3.5 pr-2.5 py-2.5 rounded-xl text-body font-medium text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-0 ${
                    currentPath.startsWith('/dashboard/admin')
                      ? 'bg-white text-accent-700 shadow-[0_2px_10px_-2px_rgba(4,20,45,0.45)]'
                      : 'text-white hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-accent-600 transition-all duration-300 ${currentPath.startsWith('/dashboard/admin') ? 'h-5 opacity-100' : 'h-0 opacity-0'}`}
                    aria-hidden="true"
                  />
                  <LayoutDashboard className={`w-4.5 h-4.5 flex-shrink-0 transition-colors duration-200 ${currentPath.startsWith('/dashboard/admin') ? 'text-accent-600' : 'text-white/60 group-hover:text-white'}`} />
                  <span className="flex-1 truncate transition-transform duration-200 group-hover:translate-x-0.5">
                    Admin dashboard
                  </span>
                </button>
              </div>
            </div>
          )}
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

// ── Guard Shell (persistent layout for all guard pages) ───────────────
export function GuardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userData = await auth.me();
        const isGuard = userData.memberships.some((m) =>
          m.role === 'SECURITY_GUARD' || m.role === 'COMMITTEE_ADMIN' || m.role === 'SUPER_ADMIN'
        );
        if (!isGuard) {
          router.push('/login');
          return;
        }
        if (cancelled) return;
        setUser(userData);
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
        <LoadingScreen label="Loading security gate" hint="Checking your guard access." />
      </div>
    );
  }

  const society = user?.memberships[0];
  const isAdmin = user?.memberships.some((m) =>
    m.role === 'COMMITTEE_ADMIN' || m.role === 'SUPER_ADMIN'
  ) ?? false;

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <GuardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
      />

      {/* Header */}
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
              <p className="truncate text-body-sm font-semibold text-gray-900">Security Gate</p>
              <p className="text-caption-xs text-gray-500">{society?.societyName || 'Dashboard'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:block text-caption text-gray-700">{user?.user.name}</span>
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:text-status-danger hover:bg-gray-50">
              <LogOut className="w-4 h-4" />
              <span className="text-body-sm font-medium hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-72">
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
