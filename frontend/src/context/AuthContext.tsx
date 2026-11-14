'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import api from '@/lib/api';
import {
  Entitlements,
  ServiceModuleKey,
  activeModules,
  aiEnabled as aiEnabledForEntitlements,
  hasPlan as hasPlanForEntitlements,
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
  /**
   * Services whose one-time welcome this user has already been shown.
   *
   * Server-held, per user, so "once" survives a new browser, a cleared cache
   * and a second device. Absent on an older session payload, which reads as
   * "none seen" -- showing a welcome once more is the harmless direction.
   */
  moduleWelcomesSeen?: ServiceModuleKey[];
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
  login: (token: string, userData: User, redirectTo?: string | null) => void;
  logout: () => void;
  can: (permission: string | string[]) => boolean;
  canAny: (permissions: string[]) => boolean;
  hasModule: (module: ServiceModuleKey) => boolean;
  /**
   * Whether the account has any plan. False means the API refuses every screen
   * but the plan page, so the UI shows "choose a plan" instead of the app.
   */
  hasPlan: boolean;
  /** Whether AI (Gemini) features are on this tenant's plan (false on Trial). */
  aiEnabled: boolean;
  entitlements: Entitlements | null;
  /** Whether this user has already been shown a service's one-time welcome. */
  welcomeSeen: (module: ServiceModuleKey) => boolean;
  /** Records that they have now seen it. Optimistic; persists server-side. */
  markWelcomeSeen: (module: ServiceModuleKey) => void;
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
    moduleWelcomesSeen: Array.isArray(value.moduleWelcomesSeen)
      ? value.moduleWelcomesSeen
      : [],
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

    // No plan: every staff destination below is refused by PlanGuard, so go
    // straight to the one page that works and is the only thing they can act
    // on. Deliberately after the portal branch -- a client or guard cannot buy
    // a plan for the tenant they belong to, so routing them to the admin plan
    // page would be a dead end. They stay on their portal, where the API
    // explains the refusal.
    if (!hasPlanForEntitlements(nextUser.entitlements)) return '/settings/plan';
    if (nextUser.role === 'finance' && modules.has('FINANCE')) return '/finance';
    // A supervisor's job is the live patrol board, so start them there rather
    // than on the sales-shaped dashboard.
    if (nextUser.role === 'supervisor' && entitled('patrols.view')) {
      return '/patrol/monitor';
    }
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
      // /super-admin is not a screen of the customer app and has its own
      // session (PlatformAuthContext). Hydrating here would send the tenant
      // token to users/me from the platform console -- pointless, and it
      // would put a tenant user object into a surface that must know
      // nothing about tenant sessions.
      const isAuthScreen =
        pathname === '/login' ||
        pathname === '/client' ||
        pathname.startsWith('/client/') ||
        pathname === '/guard' ||
        pathname.startsWith('/guard/') ||
        pathname === '/super-admin' ||
        pathname.startsWith('/super-admin/');
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

  const login = (token: string, userData: User, redirectTo?: string | null) => {
    const nextUser = normalizeUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
    // `redirectTo` lets a caller land the user somewhere specific after auth --
    // used so a visitor who came from the marketing site's "Select plan"
    // button (…/login?next=/settings/plan) is taken to the pricing page rather
    // than the default dashboard. Only internal, same-origin paths are honored;
    // anything else falls back to the role-based landing page.
    const safeRedirect =
      redirectTo &&
      redirectTo.startsWith('/') &&
      !redirectTo.startsWith('//')
        ? redirectTo
        : null;
    router.push(safeRedirect ?? getRedirectPath(nextUser));
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

  const welcomeSeen = (module: ServiceModuleKey) =>
    (user?.moduleWelcomesSeen ?? []).includes(module);

  /**
   * Marks a service's welcome as seen.
   *
   * Updates local state first so the dialog closes instantly and cannot
   * reopen on the next render while the request is in flight, then persists.
   * A failed write is swallowed deliberately: the worst case is the welcome
   * appearing once more on the next visit, which is not worth a toast on a
   * screen the user has just dismissed.
   *
   * The server, not this, owns the dedupe -- it appends only if absent -- so a
   * double-fire costs nothing.
   */
  const markWelcomeSeen = (module: ServiceModuleKey) => {
    setUser((current) => {
      if (!current) return current;
      const seen = current.moduleWelcomesSeen ?? [];
      if (seen.includes(module)) return current;
      const next = { ...current, moduleWelcomesSeen: [...seen, module] };
      // Keep the cached copy in step: a reload reads this before /users/me
      // answers, and a stale copy would flash the welcome again.
      try {
        localStorage.setItem('user', JSON.stringify(next));
      } catch {
        // Storage unavailable; the server copy is still authoritative.
      }
      return next;
    });

    void api
      .post('users/me/module-welcome', { module })
      .catch(() => undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        can,
        canAny,
        hasModule,
        hasPlan: hasPlanForEntitlements(user?.entitlements),
        aiEnabled: aiEnabledForEntitlements(user?.entitlements),
        entitlements: user?.entitlements ?? null,
        welcomeSeen,
        markWelcomeSeen,
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
