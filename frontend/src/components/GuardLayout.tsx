'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';

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
  ];

  return (
    <div className="min-h-screen bg-[#071013] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071013]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/guard/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="text-sm font-bold uppercase tracking-widest text-emerald-300">Guard Portal</div>
              <div className="text-xs text-slate-500">Assigned shifts</div>
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

        <nav className="mx-auto flex max-w-5xl gap-2 px-4 pb-4">
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

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
