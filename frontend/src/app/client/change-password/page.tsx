'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import BrandMark from '@/components/BrandMark';
import PasswordInput from '@/components/PasswordInput';

interface ApiError {
  response?: { data?: { message?: string | string[] } };
  request?: unknown;
}

const errorMessageFrom = (err: unknown, fallback: string) => {
  const apiError = err as ApiError;
  const message = apiError.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  if (message) return message;
  if (apiError.request && !apiError.response) {
    return 'Could not reach the server. Please check your connection and try again.';
  }
  return fallback;
};

/**
 * Forced first-login password change. The client reaches this page straight
 * after signing in with the agency-generated temporary password, and cannot get
 * into the portal until they set their own. They are already authenticated (the
 * sign-in issued real tokens), so this only collects the new password; the
 * backend's set-initial-password endpoint re-issues fresh tokens on success.
 */
export default function ClientChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reaching this page without a client session means the sign-in was never
  // completed (e.g. a bookmark or a reload after logout) -- send them back.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('client_token')) {
      router.replace('/client/login');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('client-auth/set-initial-password', {
        newPassword,
        confirmPassword,
      });

      // Fresh tokens replace the temporary-password session.
      if (res.data?.access_token)
        localStorage.setItem('client_token', res.data.access_token);
      if (res.data?.refresh_token)
        localStorage.setItem('client_refresh_token', res.data.refresh_token);

      toast.success('Your password has been set. Welcome to the portal.');
      router.push('/client/dashboard');
    } catch (err: unknown) {
      setError(errorMessageFrom(err, 'Could not set your password. Please try again.'));
    } finally {
      setSubmitting(false);
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
        </div>

        <div className="surface-card p-5 shadow-md sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Set your password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You signed in with a temporary password. Choose a new one to finish
              setting up your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-eyebrow">New Password</label>
              <PasswordInput
                icon={Lock}
                iconClassName={iconClass}
                className={inputClass}
                placeholder="••••••••"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-eyebrow">Confirm New Password</label>
              <PasswordInput
                icon={Lock}
                iconClassName={iconClass}
                className={inputClass}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <p className="rounded-[var(--radius-sm)] border border-error/20 bg-error-wash p-3 text-xs font-semibold text-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 className="animate-spin" size={18} />}
              Set Password &amp; Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
