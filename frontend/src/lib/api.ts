import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  // 1. Remove ANY existing /api or /api/ suffix
  // 2. Remove ANY trailing slashes
  // 3. Append /api/
  const cleanUrl = envUrl.split('/api')[0].replace(/\/+$/, '');
  const finalUrl = `${cleanUrl}/api/`;
  
  if (typeof window !== 'undefined') {
    console.log('API Base URL:', finalUrl);
  }
  
  return finalUrl;
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
