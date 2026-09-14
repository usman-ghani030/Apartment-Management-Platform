'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Shield, Scan, Package, Clock, LayoutDashboard, Menu, X, LogOut, HelpCircle,
} from 'lucide-react';
import { auth, ApiError } from '@/lib/api';
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
        <div className="fixed inset-0 z-[60] bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-gray-200 flex-shrink-0">
          {/* logo3.png is square with transparent padding — crop it so the wrap-around
              padding doesn't eat the sidebar width and cramp the wordmark */}
          <img src="/logo3.png" alt="OmniHome" className="h-[110px] w-[72px] object-cover object-center flex-shrink-0" />
          <span className="text-title-sm font-display text-gray-900 whitespace-nowrap">
            Omni<span className="text-accent-600">Home</span>
          </span>
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
                  const isActive = isItemActive(item);
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
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Admin dashboard shortcut — only for committee/super admins */}
          {isAdmin && (
            <div>
              <span className="text-caption-xs font-semibold uppercase tracking-widest text-gray-400 block px-2 mb-2">
                Dashboards
              </span>
              <div className="space-y-0.5">
                <button
                  onClick={() => handleNav('/dashboard/admin')}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-body-sm font-medium transition-all text-left focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:ring-offset-2 ${
                    currentPath.startsWith('/dashboard/admin')
                      ? 'bg-accent-50 text-accent-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <LayoutDashboard className="w-4.5 h-4.5 flex-shrink-0 text-gray-700" />
                  <span className="flex-1 truncate">Admin dashboard</span>
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-gray-200 px-3 py-3 flex-shrink-0">
          <span className="text-caption-xs text-gray-400 block px-2">OmniHome v1.0</span>
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-gray-700">Loading security gate...</p>
        </div>
      </div>
    );
  }

  const society = user?.memberships[0];
  const isAdmin = user?.memberships.some((m) =>
    m.role === 'COMMITTEE_ADMIN' || m.role === 'SUPER_ADMIN'
  ) ?? false;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <GuardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 lg:ml-64">
        <div className="h-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-50 transition-colors lg:hidden"
            >
              <Menu className="w-4.5 h-4.5 text-gray-700" />
            </button>
            {/* Brand lives in the sidebar — this is the society context only, so
                the dashboard doesn't show two logos at once. */}
            <button onClick={() => router.push('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="text-left">
                <p className="text-body-sm font-semibold text-gray-900">Security Gate</p>
                <p className="text-caption-xs text-gray-700">{society?.societyName || 'Dashboard'}</p>
              </div>
            </button>
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
      <main className="lg:ml-64">
        <div className="max-w-2xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
