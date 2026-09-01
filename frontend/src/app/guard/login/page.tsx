'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowRight, KeyRound, Loader2, Phone } from 'lucide-react';
import BrandMark from '@/components/BrandMark';

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function GuardLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('guard-auth/login', {
        identifier: identifier.trim(),
        password,
      });

      localStorage.setItem('guard_token', response.data.access_token);
      if (response.data.refresh_token) {
        localStorage.setItem('guard_refresh_token', response.data.refresh_token);
      }
      localStorage.setItem('guard_user', JSON.stringify(response.data.guard));
      router.push('/guard/dashboard');
    } catch (err: unknown) {
      setError((err as ApiError).response?.data?.message || 'Unable to sign in. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-[var(--radius)] border border-border bg-card py-3.5 pl-11 pr-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-ring/50';
  const iconClass =
    'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 pb-28 pt-10 sm:pb-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" showWordmark={false} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Guard Sign In</h1>
            <p className="mt-1 text-sm text-muted-foreground">Access your assigned field shifts and patrols.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="surface-card p-5 shadow-md sm:p-8">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-eyebrow">Phone or email</label>
              <div className="relative">
                <Phone className={iconClass} size={18} />
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className={inputClass}
                  placeholder="phone or email"
                  autoCapitalize="none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-eyebrow">Password</label>
              <div className="relative">
                <KeyRound className={iconClass} size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                  placeholder="password"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-[var(--radius-sm)] border border-error/20 bg-error-wash px-4 py-3 text-sm font-medium text-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
