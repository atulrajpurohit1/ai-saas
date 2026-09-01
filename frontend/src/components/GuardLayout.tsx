'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, FileWarning, LayoutDashboard, LogOut, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import BrandMark from '@/components/BrandMark';
import { SyncIndicator } from './SyncIndicator';
import GuardPanicButton from './GuardPanicButton';

const links = [
  { href: '/guard/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/guard/shifts', label: 'Shifts', icon: CalendarDays },
  { href: '/guard/incidents', label: 'Incidents', icon: FileWarning },
  { href: '/guard/patrol-runs', label: 'Patrols', icon: Navigation },
];

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('guard_token');
    if (!token) {
      router.push('/guard/login');
    }
  }, [router]);

  const handleLogout = () => {
    const refreshToken = localStorage.getItem('guard_refresh_token');
    localStorage.removeItem('guard_token');
    localStorage.removeItem('guard_refresh_token');
    localStorage.removeItem('guard_user');
    // Best-effort server-side revoke of the refresh token; never block logout on it.
    if (refreshToken) {
      api
        .post('guard-auth/logout', {}, { headers: { Authorization: `Bearer ${refreshToken}` } })
        .catch(() => undefined);
    }
    router.push('/guard/login');
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <Link href="/guard/dashboard">
            <BrandMark subtitle="Guard Portal" size="sm" />
          </Link>

          <button
            onClick={handleLogout}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Desktop / tablet tab bar */}
        <nav className="mx-auto hidden max-w-5xl gap-2 px-4 pb-4 sm:flex">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors sm:flex-none',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <GuardPanicButton />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:py-8 sm:pb-8">{children}</main>

      {/* Mobile bottom nav — large tap targets for field use */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur sm:hidden">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <SyncIndicator />
    </div>
  );
}
