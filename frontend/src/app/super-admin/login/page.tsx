'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
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
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            AegisLead Platform Admin
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Platform operators only. This is not the customer sign-in.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div>
            <label
              htmlFor="platform-email"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="platform-password"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Password
            </label>
            <input
              id="platform-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
