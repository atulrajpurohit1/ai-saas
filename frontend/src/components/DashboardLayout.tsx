'use client';

import React, { useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import CommandPalette from '@/components/CommandPalette';
import { useAuth, type User } from '@/context/AuthContext';
import { getBranding } from '@/lib/branding';
import { useRouter } from 'next/navigation';
import { Menu, Search, LogOut, ChevronDown } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  allowedRoles?: User['role'][];
  requiredPermissions?: string | string[];
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 transition hover:bg-black/[0.03]"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {user?.name?.charAt(0) || 'U'}
        </div>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-lg border border-border bg-card p-1.5 shadow-md">
          <div className="border-b border-border px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-error transition-colors hover:bg-error-wash"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

const SIDEBAR_COLLAPSED_KEY = 'ai-saas-sidebar-collapsed';

export default function DashboardLayout({ children, allowedRoles, requiredPermissions }: DashboardLayoutProps) {
  const { user, loading, can } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      }
      return next;
    });
  };

  useEffect(() => {
    getBranding()
      .then((branding) => setCompanyName(branding.company_name || null))
      .catch(() => {
        // Roles without branding.view just keep the tenant-name fallback below.
      });
  }, []);
  const permissionsBlocked = Boolean(user && requiredPermissions && !can(requiredPermissions));
  const isBlocked = Boolean(
    user &&
      ((allowedRoles && !allowedRoles.includes(user.role)) || permissionsBlocked),
  );

  const fallbackPath = () => {
    const permissions = new Set(user?.permissions || []);
    if (user?.role === 'client') return '/client/dashboard';
    if (permissions.has('dashboard.view')) return '/';
    if (permissions.has('shifts.view')) return '/shifts';
    if (permissions.has('finance.view')) return '/finance';
    if (permissions.has('invoices.view')) return '/invoices';
    if (permissions.has('leads.view')) return '/leads';
    if (permissions.has('integrations.view')) return '/integrations';
    return '/login';
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && isBlocked) {
      router.push(fallbackPath());
    }
  }, [isBlocked, loading, router, user]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || isBlocked) return null;

  const firstName = user.name?.split(' ')[0] || user.email;

  return (
    <div className="min-h-dvh bg-background">
      <div className="lg:hidden">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-3 py-3 backdrop-blur sm:px-4">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-foreground"
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0 text-right">
              <div className="truncate text-sm font-bold text-foreground">{companyName || user?.tenantName || 'Ai Saas'}</div>
              <div className="text-xs text-muted-foreground">{user.role === 'finance' ? 'Finance workspace' : 'Admin workspace'}</div>
            </div>
          </div>
        </header>
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />

      <div className={sidebarCollapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-64'}>
        <header className="sticky top-0 z-30 hidden border-b border-border bg-card/80 px-8 py-4 backdrop-blur lg:block">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-foreground">
                {greeting()}, {firstName}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Here&apos;s what&apos;s happening across your sales pipeline today.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                <Search size={14} />
                <span className="hidden sm:inline">Search</span>
                <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold sm:inline">
                  ⌘K
                </kbd>
              </button>
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="min-w-0 px-3 py-4 pb-24 sm:px-6 sm:py-7 sm:pb-16 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
