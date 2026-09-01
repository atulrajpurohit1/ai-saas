'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  LayoutDashboard,
  User,
  Folder,
  Menu,
  X,
  FileWarning,
  FileText,
  Receipt,
  Umbrella,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandMark from '@/components/BrandMark';

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/client/dashboard' },
  { name: 'Documents', icon: Folder, href: '/client/documents' },
  { name: 'Incidents', icon: FileWarning, href: '/client/incidents' },
  { name: 'Reports', icon: FileText, href: '/client/reports' },
  { name: 'Invoices', icon: Receipt, href: '/client/invoices' },
  { name: 'Insurance', icon: Umbrella, href: '/client/insurance' },
  { name: 'Profile', icon: User, href: '/client/profile' },
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('client_token');
    localStorage.removeItem('client_refresh_token');
    router.push('/client/login');
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const navLink = (item: (typeof menuItems)[number], onClick?: () => void) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        className={cn(
          'group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-primary/8 font-semibold text-primary'
            : 'font-medium text-muted-foreground hover:bg-black/[0.03] hover:text-foreground',
        )}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary"
            aria-hidden="true"
          />
        )}
        <item.icon
          size={18}
          className={cn('shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}
        />
        <span className="truncate">{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="p-4 sm:p-5">
          <Link href="/client/dashboard">
            <BrandMark subtitle="Client Portal" />
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {menuItems.map((item) => navLink(item))}
        </nav>
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error-wash"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-3 py-3 backdrop-blur sm:px-4 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <Link href="/client/dashboard">
            <BrandMark subtitle="Client Portal" size="sm" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-foreground"
            aria-label="Open client navigation"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close navigation overlay"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-dvh w-72 max-w-[85vw] flex-col border-l border-border bg-card p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-3">
              <BrandMark subtitle="Client Portal" size="sm" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-black/[0.04] hover:text-foreground"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="space-y-0.5">
              {menuItems.map((item) => navLink(item, () => setMenuOpen(false)))}
            </nav>
            <button
              onClick={handleLogout}
              className="mt-auto flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-error transition hover:bg-error-wash"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </aside>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-7 border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur lg:hidden">
        {menuItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon size={18} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <main className="px-3 pb-28 pt-4 sm:px-6 sm:pb-16 sm:pt-7 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
