'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Lock, Mail, Building2, User, Shield, Briefcase, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/BrandMark';

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [role, setRole] = useState<'admin' | 'client'>('admin');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const slugLabel = role === 'admin' ? 'Company Slug' : 'Company Name';
  const slugPlaceholder = role === 'admin' ? 'acme-security' : 'Acme Security';

  const completeAdminLogin = async (
    accessToken: string,
    refreshToken: string | undefined,
    fallbackName: string,
    fallbackTenantName?: string,
  ) => {
    localStorage.setItem('token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    const me = await api.get('users/me');
    login(accessToken, {
      ...me.data,
      name: me.data.name || fallbackName,
      tenantName: me.data.tenantName || fallbackTenantName,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    const normalizedTenantSlug = normalizeSlug(tenantSlug);
    setTenantSlug(normalizedTenantSlug);
    
    try {
      if (role === 'admin') {
        if (isRegister) {
          localStorage.removeItem('client_token');
          localStorage.removeItem('client_refresh_token');
          localStorage.removeItem('guard_token');
          const res = await api.post('auth/register', {
            name: name || 'Admin',
            email,
            password,
            tenantName,
            tenantSlug: normalizedTenantSlug
          });
          await completeAdminLogin(res.data.access_token, res.data.refresh_token, name || 'Admin', tenantName);
        } else {
          localStorage.removeItem('client_token');
          localStorage.removeItem('client_refresh_token');
          localStorage.removeItem('guard_token');
          const res = await api.post('auth/login', { email, password });
          await completeAdminLogin(res.data.access_token, res.data.refresh_token, 'Admin User');
        }
      } else {
        // Client Flow
        if (isRegister) {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          localStorage.removeItem('guard_token');
          const res = await api.post('client-auth/register', {
            name,
            email,
            password,
            tenantSlug: normalizedTenantSlug
          });
          localStorage.setItem('client_token', res.data.access_token);
          router.push('/client/dashboard');
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          localStorage.removeItem('guard_token');
          const res = await api.post('client-auth/login', { email, password });
          localStorage.setItem('client_token', res.data.access_token);
          router.push('/client/dashboard');
        }
      }
    } catch (err: unknown) {
      const errorMessage = (err as ApiError).response?.data?.message || 'Authentication failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-[var(--radius)] border border-border bg-card py-3 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-ring/50';
  const iconClass =
    'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 pb-28 pt-10 sm:pb-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" showWordmark={false} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Aegis<span className="text-primary">Lead</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Security operations &amp; sales platform</p>
          </div>
        </div>

        <div className="surface-card p-5 shadow-md sm:p-8">
          {/* Role Switcher */}
          <div className="mb-7 flex gap-1 rounded-[var(--radius)] border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => { setRole('admin'); setError(''); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] py-2.5 text-xs font-bold uppercase tracking-wide transition ${role === 'admin' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Shield size={14} />
              Admin
            </button>
            <button
              type="button"
              onClick={() => { setRole('client'); setError(''); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] py-2.5 text-xs font-bold uppercase tracking-wide transition ${role === 'client' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <User size={14} />
              Client
            </button>
          </div>

          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            {isRegister ? 'Create account' : 'Welcome back'}
          </h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            {isRegister
              ? `Signing up as a ${role === 'admin' ? 'company administrator' : 'client'}`
              : `Sign in to your ${role === 'admin' ? 'admin' : 'client'} dashboard`}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-eyebrow">Full Name</label>
                <div className="relative">
                  <User className={iconClass} size={17} />
                  <input type="text" className={inputClass} placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>
            )}

            {isRegister && role === 'admin' && (
              <div className="space-y-1.5">
                <label className="text-eyebrow">Company Name</label>
                <div className="relative">
                  <Building2 className={iconClass} size={17} />
                  <input type="text" className={inputClass} placeholder="Acme Security" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
                </div>
              </div>
            )}

            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-eyebrow">{slugLabel}</label>
                <div className="relative">
                  <Briefcase className={iconClass} size={17} />
                  <input type="text" autoCapitalize="none" spellCheck={false} className={inputClass} placeholder={slugPlaceholder} value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} required />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-eyebrow">Email Address</label>
              <div className="relative">
                <Mail className={iconClass} size={17} />
                <input type="email" className={inputClass} placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-eyebrow">Password</label>
              <div className="relative">
                <Lock className={iconClass} size={17} />
                <input type="password" className={inputClass} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            {error && (
              <p className="rounded-[var(--radius-sm)] border border-error/20 bg-error-wash p-3 text-xs font-semibold text-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <Loader2 className="animate-spin" size={18} />}
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm font-semibold text-muted-foreground transition hover:text-primary"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Are you a security officer?{' '}
          <a href="/guard/login" className="font-semibold text-primary hover:underline">
            Guard sign in
          </a>
        </p>
      </div>
    </div>
  );
}
