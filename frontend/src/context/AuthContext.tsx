'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export interface User {
  id?: string;
  email: string;
  role: string;
  name?: string | null;
  tenantName?: string;
  tenantId?: string;
  branchId?: string | null;
  isSuperAdmin?: boolean;
  permissions?: string[];
  roles?: {
    assignmentId: string;
    id: string;
    name: string;
    isSystemRole: boolean;
    branchId?: string | null;
  }[];
}

interface AuthContextType {
  user: User | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  can: (permission: string | string[]) => boolean;
  canAny: (permissions: string[]) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const normalizeUser = (value: User): User => ({
    ...value,
    permissions: Array.isArray(value.permissions) ? value.permissions : [],
    roles: Array.isArray(value.roles) ? value.roles : [],
  });

  const getRedirectPath = (nextUser: User) => {
    const permissions = new Set(nextUser.permissions || []);
    if (nextUser.role === 'client') return '/client/dashboard';
    if (nextUser.role === 'finance') return '/finance';
    if (!permissions.has('dashboard.view')) {
      if (permissions.has('shifts.view')) return '/shifts';
      if (permissions.has('finance.view')) return '/finance';
      if (permissions.has('invoices.view')) return '/invoices';
      if (permissions.has('leads.view')) return '/leads';
      if (permissions.has('integrations.view')) return '/integrations';
      if (permissions.has('roles.view')) return '/settings/roles';
    }
    return '/';
  };

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const pathname = window.location.pathname;
      const isAuthScreen =
        pathname === '/login' ||
        pathname === '/client' ||
        pathname.startsWith('/client/') ||
        pathname === '/guard' ||
        pathname.startsWith('/guard/');
      if (isAuthScreen) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (!token) {
        setLoading(false);
        return;
      }

      if (storedUser) {
        try {
          setUser(normalizeUser(JSON.parse(storedUser)));
        } catch (e) {
          console.error('Failed to parse stored user', e);
          localStorage.removeItem('user');
        }
      }

      try {
        const res = await api.get<User>('users/me');
        const nextUser = normalizeUser(res.data);
        if (!mounted) return;
        localStorage.setItem('user', JSON.stringify(nextUser));
        setUser(nextUser);
      } catch (e) {
        console.error('Failed to refresh current user', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }, [loading, user]);

  const login = (token: string, userData: User) => {
    const nextUser = normalizeUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
    router.push(getRedirectPath(nextUser));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  const can = (permission: string | string[]) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    const permissions = new Set(user.permissions || []);
    const required = Array.isArray(permission) ? permission : [permission];
    return required.every((item) => permissions.has(item));
  };

  const canAny = (permissionsToCheck: string[]) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    const permissions = new Set(user.permissions || []);
    return permissionsToCheck.some((permission) => permissions.has(permission));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, can, canAny, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
