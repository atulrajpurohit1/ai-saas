'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, FileWarning, LayoutDashboard, LogOut, ShieldCheck, Navigation } from 'lucide-react';

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
    localStorage.removeItem('guard_token');
    localStorage.removeItem('guard_user');
    router.push('/guard/login');
  };

  const links = [
    { href: '/guard/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/guard/shifts', label: 'Shifts', icon: CalendarDays },
    { href: '/guard/incidents', label: 'Incidents', icon: FileWarning },
    { href: '/guard/patrol-runs', label: 'Patrols', icon: Navigation },
  ];

  return (
    <div className="min-h-screen bg-[#071013] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071013]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <Link href="/guard/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <ShieldCheck size={22} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold uppercase tracking-widest text-emerald-300">Guard Portal</div>
              <div className="truncate text-xs text-slate-500">Assigned shifts</div>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        <nav className="mx-auto hidden max-w-5xl gap-2 px-4 pb-4 sm:flex">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                  active
                    ? 'bg-emerald-500 text-white'
                    : 'border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:pb-8 sm:py-8">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#071013]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur sm:hidden">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition-colors ${
                active
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
