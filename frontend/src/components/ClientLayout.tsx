'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, LayoutDashboard, User, Folder, Shield, Menu, X } from 'lucide-react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('client_token');
    router.push('/client/login');
  };

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/client/dashboard' },
    { name: 'Documents', icon: Folder, href: '/client/documents' },
    { name: 'Profile', icon: User, href: '/client/profile' },
  ];

  return (
    <div className="min-h-screen bg-[#05050a] text-slate-200 font-sans selection:bg-indigo-500/30">
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#0a0a14] border-r border-white/5 z-50 hidden lg:block">
        <div className="p-8">
          <Link href="/client/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
              <Shield className="text-white" size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">ClientPortal</span>
          </Link>
        </div>

        <nav className="px-4 mt-4 space-y-2">
          {menuItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href} 
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-medium transition-all ${
                pathname === item.href
                  ? 'border-indigo-500/20 bg-indigo-600/15 text-white'
                  : 'border-transparent text-slate-400 hover:border-white/5 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} className="text-indigo-400/70" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-8 left-0 w-full px-8">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-muted-foreground hover:text-white transition-colors w-full group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-all">
              <LogOut size={18} />
            </div>
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05050a]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <Link href="/client/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              <Shield size={22} />
            </div>
            <span className="truncate text-lg font-bold tracking-tight text-white">ClientPortal</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
            aria-label="Open client navigation"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close navigation overlay"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-dvh w-72 max-w-[85vw] flex-col border-l border-white/10 bg-[#0a0a14] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Shield size={22} />
                </div>
                <span className="font-bold text-white">ClientPortal</span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 font-semibold transition ${
                    pathname === item.href
                      ? 'border-indigo-500/20 bg-indigo-600/15 text-white'
                      : 'border-transparent text-slate-400 hover:border-white/5 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <item.icon size={20} className="text-indigo-400/70" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>

            <button
              onClick={handleLogout}
              className="mt-auto flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={20} />
              <span className="font-semibold">Sign Out</span>
            </button>
          </aside>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t border-white/10 bg-[#05050a]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">
        {menuItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition ${
                active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <main className="px-4 pb-28 pt-5 sm:px-6 md:px-8 md:py-8 lg:ml-64 lg:p-12">
        <div className="mx-auto w-full max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
