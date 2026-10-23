import axios from 'axios';
import { toast } from 'sonner';

const getBaseUrl = () => {
  const fallbackUrl = 'https://ai-saas-backend-ulpb.onrender.com/api';
  const envUrl = process.env.NEXT_PUBLIC_API_URL || fallbackUrl;
  const apiUrl = envUrl.includes('ai-saas-3.onrender.com') ? fallbackUrl : envUrl;

  // 1. Remove ANY existing /api or /api/ suffix
  // 2. Remove ANY trailing slashes
  // 3. Append /api/
  const cleanUrl = apiUrl.split('/api')[0].replace(/\/+$/, '');
  const finalUrl = `${cleanUrl}/api/`;

  return finalUrl;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 25000,
});

type Portal = 'admin' | 'client' | 'guard';

const PORTAL_STORAGE_KEYS: Record<Portal, { token: string; refreshToken: string | null; loginPath: string }> = {
  admin: { token: 'token', refreshToken: 'refresh_token', loginPath: '/login' },
  client: { token: 'client_token', refreshToken: 'client_refresh_token', loginPath: '/client/login' },
  guard: { token: 'guard_token', refreshToken: 'guard_refresh_token', loginPath: '/guard/login' },
};

const REFRESH_ENDPOINTS: Record<Portal, string> = {
  admin: 'auth/refresh',
  client: 'client-auth/refresh',
  guard: 'guard-auth/refresh',
};

const getPortalForPath = (pathname: string): Portal => {
  if (pathname === '/client' || pathname.startsWith('/client/')) return 'client';
  if (pathname === '/guard' || pathname.startsWith('/guard/')) return 'guard';
  return 'admin';
};

const clearPortalSession = (portal: Portal) => {
  const keys = PORTAL_STORAGE_KEYS[portal];
  localStorage.removeItem(keys.token);
  if (keys.refreshToken) localStorage.removeItem(keys.refreshToken);
  if (portal === 'admin') localStorage.removeItem('user');
  if (portal === 'guard') localStorage.removeItem('guard_user');
};

const redirectToLogin = (portal: Portal) => {
  const keys = PORTAL_STORAGE_KEYS[portal];
  clearPortalSession(portal);
  if (!window.location.pathname.includes(keys.loginPath)) {
    window.location.href = keys.loginPath;
  }
};

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const portal = getPortalForPath(window.location.pathname);
    const token = localStorage.getItem(PORTAL_STORAGE_KEYS[portal].token);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Shared in-flight refresh promise per portal so concurrent 401s from
// multiple simultaneous requests only trigger a single refresh call.
const refreshPromises: Partial<Record<Portal, Promise<string | null>>> = {};

const refreshAccessToken = (portal: Portal): Promise<string | null> => {
  const keys = PORTAL_STORAGE_KEYS[portal];
  const refreshEndpoint = REFRESH_ENDPOINTS[portal];

  if (!keys.refreshToken || !refreshEndpoint) {
    return Promise.resolve(null);
  }

  if (!refreshPromises[portal]) {
    refreshPromises[portal] = (async () => {
      try {
        const storedRefreshToken = localStorage.getItem(keys.refreshToken as string);
        if (!storedRefreshToken) return null;

        const response = await axios.post(
          `${getBaseUrl()}${refreshEndpoint}`,
          {},
          { headers: { Authorization: `Bearer ${storedRefreshToken}` } },
        );

        const nextAccessToken: string | undefined = response.data?.access_token;
        const nextRefreshToken: string | undefined = response.data?.refresh_token;
        if (!nextAccessToken) return null;

        localStorage.setItem(keys.token, nextAccessToken);
        if (nextRefreshToken) localStorage.setItem(keys.refreshToken as string, nextRefreshToken);
        return nextAccessToken;
      } catch {
        return null;
      } finally {
        delete refreshPromises[portal];
      }
    })();
  }

  return refreshPromises[portal] as Promise<string | null>;
};

// Response interceptor: only a genuinely invalid/expired session (a failed
// refresh attempt) forces a logout. A 401 on any other request first tries a
// silent token refresh and retries once; other errors (network, 5xx, etc.)
// are left for the calling page to handle and never log the user out.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }

    // The Trial plan allows everything except AI. When a tenant without AI hits
    // an AI endpoint the backend returns 403 AI_NOT_ON_PLAN -- the single,
    // app-wide backstop so that reaching an AI action always degrades to a
    // clear "upgrade" toast rather than a raw error, even on a page that does
    // not handle the error itself. A fixed toast id dedupes repeat clicks. The
    // error is still rejected so page logic (spinners, local state) unwinds.
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === 'AI_NOT_ON_PLAN'
    ) {
      toast.error(
        error.response?.data?.message ||
          'AI features are not included in your plan. Upgrade to a paid plan to use them.',
        { id: 'ai-not-on-plan' },
      );
      return Promise.reject(error);
    }

    // ModuleGuard denies a service the tenant never bought. That is an upsell,
    // not an auth failure, so it must not trigger a refresh or a logout --
    // send them somewhere they can actually buy it instead.
    if (error.response?.status === 403 && error.response?.data?.upgradeRequired) {
      const modules: string[] = error.response.data.modules || [];
      const portal = getPortalForPath(window.location.pathname);
      if (portal === 'admin' && !window.location.pathname.startsWith('/settings/plan')) {
        const query = modules.length ? `?module=${encodeURIComponent(modules[0])}` : '';
        window.location.href = `/settings/plan${query}`;
      }
      return Promise.reject(error);
    }

    // A guard whose account was deactivated mid-session: the backend rejects
    // their token with this code. Don't try to refresh (a new token would be
    // rejected too) - end the session immediately and tell them why.
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'GUARD_DEACTIVATED'
    ) {
      toast.error(
        error.response?.data?.message ||
          'Your guard account has been deactivated by an administrator.',
        { id: 'guard-deactivated' },
      );
      clearPortalSession('guard');
      redirectToLogin('guard');
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const portal = getPortalForPath(window.location.pathname);
    const originalRequest = error.config;
    const refreshEndpoint = REFRESH_ENDPOINTS[portal];
    const isRefreshCall = Boolean(refreshEndpoint) && originalRequest?.url?.includes(refreshEndpoint);

    if (!originalRequest || isRefreshCall || originalRequest._retried) {
      redirectToLogin(portal);
      return Promise.reject(error);
    }

    const nextAccessToken = await refreshAccessToken(portal);
    if (!nextAccessToken) {
      redirectToLogin(portal);
      return Promise.reject(error);
    }

    originalRequest._retried = true;
    originalRequest.headers = originalRequest.headers || {};
    originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
    return api(originalRequest);
  }
);

export default api;
