import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';
  
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
  if (typeof window !== 'undefined') {
    const isClientRoute = window.location.pathname.startsWith('/client');
    const token = isClientRoute 
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
    if (typeof window !== 'undefined') {
      console.error('API Error:', {
        message: error.message,
        code: error.code,
        config: error.config,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'No response'
      });
    }
    
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const isClientRoute = window.location.pathname.startsWith('/client');
        if (isClientRoute) {
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
