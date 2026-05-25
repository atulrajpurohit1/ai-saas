import axios from 'axios';

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
});

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const isClientRoute = pathname === '/client' || pathname.startsWith('/client/');
    const isGuardRoute = pathname === '/guard' || pathname.startsWith('/guard/');
    const token = isGuardRoute
      ? localStorage.getItem('guard_token')
      : isClientRoute
        ? localStorage.getItem('client_token') || localStorage.getItem('token')
        : localStorage.getItem('token');
      
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        const isClientRoute = pathname === '/client' || pathname.startsWith('/client/');
        const isGuardRoute = pathname === '/guard' || pathname.startsWith('/guard/');
        if (isGuardRoute) {
          if (!window.location.pathname.includes('/guard/login')) {
            localStorage.removeItem('guard_token');
            window.location.href = '/guard/login';
          }
        } else if (isClientRoute) {
          if (!window.location.pathname.includes('/client/login')) {
            localStorage.removeItem('client_token');
            window.location.href = '/client/login';
          }
        } else {
          if (!window.location.pathname.includes('/login')) {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
