'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { usePlatformAuth } from '@/context/PlatformAuthContext';
import { getApiErrorMessage } from '@/lib/api-error';

/**
 * Sign-in for the platform console.
 *
 * Deliberately its own page and not the customer /login: the two authenticate
 * against different credential stores, and a tenant signing in here would get
 * "Invalid platform credentials" no matter how valid their tenant password is.
 *
 * There is no "forgot password", no signup link, and no link back to the
 * customer app. A platform password is reset by whoever runs the box, with
 * prisma/seed-platform-admin.ts; a self-service reset route would be a second
 * way into the highest-privilege account in the system, guarded only by an
 * inbox.
 */
export default function PlatformLoginPage() {
  const { admin, loading, login } = usePlatformAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // An operator who is already signed in has no reason to see a login form.
  useEffect(() => {
    if (!loading && admin) router.replace('/super-admin');
  }, [admin, loading, router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/super-admin');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid platform credentials.'));
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.13),transparent_68%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <LockKeyhole className="h-3 w-3 text-emerald-600" /> Restricted
            access
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            AegisLead Platform Admin
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Platform operators only. This is not the customer sign-in.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-lg shadow-black/[0.04]"
        >
          <div>
            <label
              htmlFor="platform-email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="platform-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@company.com"
              autoFocus
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div>
            <label
              htmlFor="platform-password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="platform-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-11 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>

          <div className="grid gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Rate-limited sign-in
            </span>
            <span className="flex items-center gap-1.5 sm:justify-end">
              <LockKeyhole className="h-3.5 w-3.5 text-emerald-600" />
              15-minute idle lock
            </span>
          </div>
        </form>
        <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
          Sessions are tab-scoped and automatically cleared when this tab
          closes.
        </p>
      </div>
    </div>
  );
}
