'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import platformApi, {
  clearPlatformSession,
  storePlatformSession,
} from '@/lib/platform-api';

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string | null;
}

interface PlatformAuthContextType {
  admin: PlatformAdmin | null;
  loading: boolean;
  idleMinutesRemaining: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PLATFORM_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

const PlatformAuthContext = createContext<PlatformAuthContextType | undefined>(
  undefined,
);

/**
 * Session state for the platform console. Entirely separate from AuthContext:
 * a different token, a different endpoint, a different user type.
 *
 * `admin` is only ever populated from a successful `platform-auth/me` call, so
 * the console's visibility rests on a server answer rather than on anything
 * the browser is holding. Writing `{"isSuperAdmin":true}` into localStorage --
 * which was enough to reveal the old console's UI -- achieves nothing here.
 */
export function PlatformAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [idleMinutesRemaining, setIdleMinutesRemaining] = useState(15);

  const loadMe = useCallback(async () => {
    try {
      const res = await platformApi.get<PlatformAdmin>('platform-auth/me');
      setAdmin({ id: res.data.id, email: res.data.email, name: res.data.name });
    } catch {
      // Any failure means "not signed in". No distinction is drawn between an
      // absent token, an expired one and a revoked account.
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await platformApi.post('platform-auth/login', {
        email,
        password,
      });
      storePlatformSession(res.data.access_token, res.data.refresh_token);
      // Deliberately re-asks the server who we are rather than trusting the
      // login response body, so there is exactly one code path that decides
      // whether this browser is a platform admin.
      setLoading(true);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    try {
      await platformApi.post('platform-auth/logout');
    } catch {
      // Best effort: the server drops the stored refresh hash, but a network
      // failure must not leave the operator stuck in a session they asked to
      // end. The local token is cleared either way.
    }
    clearPlatformSession();
    setAdmin(null);
  }, []);

  useEffect(() => {
    if (!admin) {
      setIdleMinutesRemaining(15);
      return;
    }

    let lastActivity = Date.now();
    let locking = false;

    const recordActivity = () => {
      lastActivity = Date.now();
      setIdleMinutesRemaining(15);
    };

    const checkIdle = () => {
      const remaining = PLATFORM_IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
      setIdleMinutesRemaining(Math.max(0, Math.ceil(remaining / 60_000)));

      if (remaining > 0 || locking) return;
      locking = true;
      // Hide privileged data immediately, then revoke the server-side refresh
      // token. logout() clears the browser tokens even if that request fails.
      setAdmin(null);
      void logout();
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      'keydown',
      'pointerdown',
      'scroll',
      'touchstart',
    ];
    activityEvents.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true }),
    );
    window.addEventListener('focus', recordActivity);
    const interval = window.setInterval(checkIdle, 15_000);
    checkIdle();

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, recordActivity),
      );
      window.removeEventListener('focus', recordActivity);
      window.clearInterval(interval);
    };
  }, [admin, logout]);

  return (
    <PlatformAuthContext.Provider
      value={{ admin, loading, idleMinutesRemaining, login, logout }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const context = useContext(PlatformAuthContext);
  if (context === undefined) {
    throw new Error(
      'usePlatformAuth must be used within a PlatformAuthProvider',
    );
  }
  return context;
}
