'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import api from '@/lib/api';
import {
  Entitlements,
  ServiceModuleKey,
  activeModules,
  serviceForPermission,
} from '@/lib/entitlements';

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
  entitlements?: Entitlements | null;
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
  hasModule: (module: ServiceModuleKey) => boolean;
  entitlements: Entitlements | null;
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
    entitlements: value.entitlements ?? null,
    roles: Array.isArray(value.roles) ? value.roles : [],
  });

  const getRedirectPath = (nextUser: User) => {
    const permissions = new Set(nextUser.permissions || []);
    const modules = activeModules(nextUser.entitlements);

    // Landing must respect entitlement as well as permission: sending a
    // Lead-Gen-only user to /shifts would 403 them straight after login.
    const entitled = (permission: string) => {
      if (!permissions.has(permission)) return false;
      const service = serviceForPermission(permission);
      return service === null || modules.has(service);
    };

    if (nextUser.role === 'client') return '/client/dashboard';
    if (nextUser.role === 'finance' && modules.has('FINANCE')) return '/finance';
    if (!permissions.has('dashboard.view')) {
      if (entitled('shifts.view')) return '/shifts';
      if (entitled('finance.view')) return '/finance';
      if (entitled('invoices.view')) return '/invoices';
      if (entitled('leads.view')) return '/leads';
      if (entitled('integrations.view')) return '/integrations';
      if (entitled('roles.view')) return '/settings/roles';
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
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          if (mounted) setUser(null);
        } else if (axios.isAxiosError(e) && !e.response) {
          console.warn('Backend is not reachable while refreshing current user. Keeping cached session.');
        } else {
          console.warn('Could not refresh current user session.');
        }
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
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  // A Super Admin holds every permission, but entitlement is a TENANT fact and
  // no role overrides it: at a Lead-Gen-only tenant they must not see Guard
  // Tour nav. ModuleGuard enforces the same rule on the API, which would
  // otherwise 403 every link rendered here.
  const entitledTo = (permission: string) => {
    const service = serviceForPermission(permission);
    return service === null || activeModules(user?.entitlements).has(service);
  };

  const can = (permission: string | string[]) => {
    if (!user) return false;
    const required = Array.isArray(permission) ? permission : [permission];
    if (!required.every(entitledTo)) return false;
    if (user.isSuperAdmin) return true;
    const permissions = new Set(user.permissions || []);
    return required.every((item) => permissions.has(item));
  };

  const canAny = (permissionsToCheck: string[]) => {
    if (!user) return false;
    const entitled = permissionsToCheck.filter(entitledTo);
    if (entitled.length === 0) return false;
    if (user.isSuperAdmin) return true;
    const permissions = new Set(user.permissions || []);
    return entitled.some((permission) => permissions.has(permission));
  };

  const hasModule = (module: ServiceModuleKey) =>
    activeModules(user?.entitlements).has(module);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        can,
        canAny,
        hasModule,
        entitlements: user?.entitlements ?? null,
        loading,
      }}
    >
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
