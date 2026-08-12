'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Home, Wrench, CreditCard } from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';
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

// ── Resident Shell (persistent layout for all resident pages) ─────────
export function ResidentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userData = await auth.me();
        const isResident = userData.memberships.some((m) => m.role === 'RESIDENT');
        if (!isResident) {
          router.push('/dashboard/admin');
          return;
        }
        if (cancelled) return;
        setUser(userData);

        // Unread-notice count for the header bell
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
          <p className="text-body-sm text-gray-700">Loading your community...</p>
        </div>
      </div>
    );
  }

  const society = user?.memberships[0];

  return (
    <ResidentShellContext.Provider value={{ user, unreadNotices }}>
      <div className="min-h-screen bg-white text-gray-900">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <button onClick={() => router.push('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center shadow-sm">
                <Home className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-body-sm font-semibold text-gray-900">{society?.societyName || 'My Community'}</p>
                <p className="text-caption-xs text-gray-700">Resident</p>
              </div>
            </button>
            <div className="flex items-center gap-1.5">
              <button className="relative p-2 rounded-lg transition-colors text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                <Bell className="w-4.5 h-4.5" />
                {unreadNotices > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white" />
                )}
              </button>
              <button onClick={handleLogout} className="p-2 rounded-lg transition-colors text-gray-700 hover:text-status-danger hover:bg-gray-50">
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6 pb-24">{children}</main>

        {/* ── Mobile bottom nav ───────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 border-t border-gray-200 px-2 py-1.5 safe-area-bottom">
          <div className="flex items-center justify-around">
            {[
              { icon: Home, label: 'Home', href: '/dashboard/resident' },
              { icon: Bell, label: 'Notices', href: '/dashboard/resident/notices' },
              { icon: Wrench, label: 'Tickets', href: '/dashboard/resident/tickets' },
              { icon: CreditCard, label: 'Payments', href: '/dashboard/resident/invoices' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors"
              >
                <item.icon className={`w-5 h-5 ${item.href === '/dashboard/resident' ? 'text-accent-600 ' : 'text-gray-700'}`} />
                <span className={`text-caption-xs font-medium ${item.href === '/dashboard/resident' ? 'text-accent-600 ' : 'text-gray-700'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </ResidentShellContext.Provider>
  );
}
