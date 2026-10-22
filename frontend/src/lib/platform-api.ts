import axios from 'axios';

/**
 * HTTP client for the platform console, separate from `@/lib/api`.
 *
 * The tenant client picks a token out of localStorage based on the current
 * PATH ('token' for the app, 'client_token' for /client, and so on). Sharing
 * it here would mean the console's requests carried a tenant's token, which is
 * precisely the confusion that let tenants into this area in the first place.
 *
 * So this instance:
 *   - reads only `platform_token`, never the tenant `token`;
 *   - refreshes against platform-auth/refresh, never auth/refresh;
 *   - on an expired session sends the operator to /super-admin/login, not to
 *     the customer login page.
 *
 * A tenant token presented to a platform endpoint is rejected by the server
 * anyway -- it is signed with a different secret -- so this separation is about
 * the console behaving sensibly, not about it being the thing that keeps
 * tenants out.
 */

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  const cleanUrl = envUrl.split('/api')[0].replace(/\/+$/, '');
  return `${cleanUrl}/api/`;
};

export const PLATFORM_TOKEN_KEY = 'platform_token';
export const PLATFORM_REFRESH_TOKEN_KEY = 'platform_refresh_token';
export const PLATFORM_LOGIN_PATH = '/super-admin/login';

const platformApi = axios.create({
  baseURL: getBaseUrl(),
  timeout: 25000,
});

export function storePlatformSession(accessToken: string, refreshToken?: string) {
  localStorage.setItem(PLATFORM_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(PLATFORM_REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearPlatformSession() {
  localStorage.removeItem(PLATFORM_TOKEN_KEY);
  localStorage.removeItem(PLATFORM_REFRESH_TOKEN_KEY);
}

platformApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(PLATFORM_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// One in-flight refresh shared by concurrent 401s, so a console screen that
// fires four requests at once does not rotate the refresh token four times --
// which would invalidate it, because the server rotates on every use.
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const stored = localStorage.getItem(PLATFORM_REFRESH_TOKEN_KEY);
        if (!stored) return null;

        const response = await axios.post(
          `${getBaseUrl()}platform-auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${stored}` } },
        );

        const nextAccess: string | undefined = response.data?.access_token;
        const nextRefresh: string | undefined = response.data?.refresh_token;
        if (!nextAccess) return null;

        storePlatformSession(nextAccess, nextRefresh);
        return nextAccess;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

platformApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === 'undefined' || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    const isRefreshCall = originalRequest?.url?.includes('platform-auth/refresh');

    const bail = () => {
      clearPlatformSession();
      if (window.location.pathname !== PLATFORM_LOGIN_PATH) {
        window.location.href = PLATFORM_LOGIN_PATH;
      }
      return Promise.reject(error);
    };

    if (!originalRequest || isRefreshCall || originalRequest._retried) {
      return bail();
    }

    const nextAccess = await refreshAccessToken();
    if (!nextAccess) return bail();

    originalRequest._retried = true;
    originalRequest.headers = originalRequest.headers || {};
    originalRequest.headers.Authorization = `Bearer ${nextAccess}`;
    return platformApi(originalRequest);
  },
);

export default platformApi;
