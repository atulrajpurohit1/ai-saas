'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, LogOut, LayoutDashboard, User } from 'lucide-react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('client_token');
    router.push('/client/login');
  };

  return (
    <div className="min-h-screen bg-[#05050a] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#0a0a14] border-r border-white/5 z-50 hidden lg:block">
        <div className="p-8">
          <Link href="/client/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
              <FileText className="text-white" size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">ClientPortal</span>
          </Link>
        </div>

        <nav className="px-4 mt-4 space-y-2">
          <Link href="/client/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 text-white font-medium hover:bg-white/10 transition-all border border-white/5">
            <LayoutDashboard size={20} className="text-indigo-400" />
            <span>Dashboard</span>
          </Link>
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

      {/* Main Content */}
      <main className="lg:ml-64 p-4 md:p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
