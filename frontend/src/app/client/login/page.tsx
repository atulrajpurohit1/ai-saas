'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Loader2, Mail, Lock, ArrowRight, User, Briefcase } from 'lucide-react';
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

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('guard_token');

      const res = isRegister
        ? await api.post('client-auth/register', {
            name,
            email,
            password,
            tenantSlug: normalizeSlug(tenantSlug),
          })
        : await api.post('client-auth/login', {
            email,
            password,
          });

      localStorage.setItem('client_token', res.data.access_token);
      if (res.data.refresh_token) localStorage.setItem('client_refresh_token', res.data.refresh_token);
      router.push('/client/dashboard');
    } catch (err: unknown) {
      setError((err as ApiError).response?.data?.message || 'Could not access the client portal.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-[var(--radius)] border border-border bg-card py-3 pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-ring/50';
  const iconClass =
    'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 pb-28 pt-10 sm:pb-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" showWordmark={false} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {isRegister ? 'Create client account' : 'Client Portal'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isRegister
                ? 'Register your client portal account.'
                : 'Access your proposals, reports, and secure service details.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="surface-card space-y-4 p-5 shadow-md sm:p-8">
          {isRegister && (
            <>
              <div className="space-y-1.5">
                <label className="text-eyebrow">Full Name</label>
                <div className="relative">
                  <User className={iconClass} size={17} />
                  <input type="text" className={inputClass} placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-eyebrow">Company Name</label>
                <div className="relative">
                  <Briefcase className={iconClass} size={17} />
                  <input type="text" autoCapitalize="none" spellCheck={false} className={inputClass} placeholder="Acme Security" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} required />
                </div>
              </div>
            </>
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
            className="group mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <span>{isRegister ? 'Create Account' : 'Sign In to Portal'}</span>
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister((current) => !current);
                setError('');
              }}
              className="text-sm font-semibold text-muted-foreground transition hover:text-primary"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Not a client?{' '}
          <a href="/login" className="font-semibold text-primary hover:underline">
            Admin sign in
          </a>
        </p>
      </div>
    </div>
  );
}
