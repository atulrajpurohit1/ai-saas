'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth, type User } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  allowedRoles?: User['role'][];
}

export default function DashboardLayout({ children, allowedRoles }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isBlocked = Boolean(user && allowedRoles && !allowedRoles.includes(user.role));

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && isBlocked) {
      router.push(user.role === 'client' ? '/client/dashboard' : '/login');
    }
  }, [isBlocked, loading, router, user]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0f172a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user || isBlocked) return null;

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="lg:hidden">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f172a]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0 text-right">
              <div className="truncate text-sm font-bold text-white">{user?.tenantName || 'Ai Saas'}</div>
              <div className="text-xs text-muted-foreground">{user.role === 'finance' ? 'Finance workspace' : 'Admin workspace'}</div>
            </div>
          </div>
        </header>
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="min-w-0 px-4 py-5 sm:px-6 sm:py-7 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
