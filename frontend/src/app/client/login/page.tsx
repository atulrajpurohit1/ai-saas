'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import BrandMark from '@/components/BrandMark';
import PasswordInput from '@/components/PasswordInput';
import OtpInput from '@/components/OtpInput';
import { getApiErrorMessage } from '@/lib/api-error';

interface ApiError {
  response?: {
    data?: {
      message?: string | string[];
    };
    status?: number;
  };
  request?: unknown;
}

// Delegates to the shared helper so this page shows the same friendly, filtered
// messages as everywhere else -- never a raw framework diagnostic such as
// "Cannot POST /api/...". The helper handles the no-response case too.
const errorMessageFrom = (err: unknown, fallback: string) =>
  getApiErrorMessage(err, fallback);

/** Masks an email for display during OTP verification, e.g. "j***@gmail.com". */
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
};

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Client portal sign-in. Sign-in only: a client account belongs to one
 * security agency, and nothing a visitor can type here identifies which one.
 * Accounts are created by the agency, which hands over a temporary password.
 *
 * On first sign-in with that temporary password the client is sent to
 * /client/change-password to choose their own, and a self-service
 * forgot-password flow (OTP to the client's email) lives here too.
 */
export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Forgot-password sub-flow. Its own small state machine; never active at the
  // same time as the sign-in form.
  type ForgotStep = 'email' | 'otp' | 'reset' | null;
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResendCooldown, setForgotResendCooldown] = useState(0);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    if (forgotResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setForgotResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotResendCooldown]);

  const resetForgotPasswordState = () => {
    setForgotStep(null);
    setForgotEmail('');
    setForgotError('');
    setForgotInfo('');
    setForgotOtp('');
    setForgotResendCooldown(0);
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const openForgotPassword = () => {
    setError('');
    setForgotEmail(email);
    setForgotStep('email');
  };

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

      const res = await api.post('client-auth/login', { email, password });

      localStorage.setItem('client_token', res.data.access_token);
      if (res.data.refresh_token)
        localStorage.setItem('client_refresh_token', res.data.refresh_token);

      // First sign-in with the agency's temporary password: the client must
      // choose their own before they reach the portal.
      if (res.data.mustChangePassword) {
        router.push('/client/change-password');
        return;
      }

      router.push('/client/dashboard');
    } catch (err: unknown) {
      setError(errorMessageFrom(err, 'Could not access the client portal.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSubmitting) return;
    setForgotError('');
    setForgotSubmitting(true);

    try {
      const res = await api.post('client-auth/forgot-password', {
        email: forgotEmail.trim(),
      });
      setForgotInfo(
        res.data?.message ||
          'If an account exists for this email, a verification code has been sent.',
      );
      setForgotOtp('');
      setForgotResendCooldown(RESEND_COOLDOWN_SECONDS);
      setForgotStep('otp');
    } catch (err: unknown) {
      setForgotError(errorMessageFrom(err, 'Something went wrong. Please try again.'));
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSubmitting || forgotOtp.length !== 6) return;
    setForgotError('');
    setForgotSubmitting(true);

    try {
      const res = await api.post('client-auth/verify-reset-otp', {
        email: forgotEmail.trim(),
        code: forgotOtp,
      });
      setResetToken(res.data.resetToken);
      setForgotStep('reset');
    } catch (err: unknown) {
      const status = (err as ApiError).response?.status;
      setForgotError(
        errorMessageFrom(
          err,
          status === 429
            ? 'Too many attempts. Please try again later.'
            : 'Invalid verification code.',
        ),
      );
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (forgotSubmitting || forgotResendCooldown > 0) return;
    setForgotError('');
    setForgotSubmitting(true);

    try {
      await api.post('client-auth/forgot-password', { email: forgotEmail.trim() });
      setForgotOtp('');
      setForgotResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('A new verification code has been sent.');
    } catch (err: unknown) {
      const status = (err as ApiError).response?.status;
      if (status === 429) {
        setForgotError(errorMessageFrom(err, 'Please wait before requesting another code.'));
      } else {
        toast.error(errorMessageFrom(err, 'Could not resend the code. Please try again.'));
      }
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSubmitting) return;
    setForgotError('');

    if (newPassword.length < 8) {
      setForgotError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotSubmitting(true);
    try {
      await api.post('client-auth/reset-password', {
        resetToken,
        newPassword,
        confirmPassword: confirmNewPassword,
      });
      toast.success('Password reset successfully. Please log in with your new password.');
      resetForgotPasswordState();
      setPassword('');
    } catch (err: unknown) {
      setForgotError(
        errorMessageFrom(err, 'Could not reset your password. Please start the process again.'),
      );
    } finally {
      setForgotSubmitting(false);
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
              Client Portal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Access your proposals, reports, and secure service details.
            </p>
          </div>
        </div>

        {forgotStep === 'email' ? (
          <div className="surface-card p-5 shadow-md sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <KeyRound size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Forgot password</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email address and we&apos;ll send you a verification code.
              </p>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-eyebrow">Email Address</label>
                <div className="relative">
                  <Mail className={iconClass} size={17} />
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="name@company.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {forgotError && (
                <p className="rounded-[var(--radius-sm)] border border-error/20 bg-error-wash p-3 text-xs font-semibold text-error" role="alert">
                  {forgotError}
                </p>
              )}

              <button
                type="submit"
                disabled={forgotSubmitting}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {forgotSubmitting && <Loader2 className="animate-spin" size={18} />}
                Send OTP
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={resetForgotPasswordState}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back to login
              </button>
            </div>
          </div>
        ) : forgotStep === 'otp' ? (
          <div className="surface-card p-5 shadow-md sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Verify your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {forgotInfo || 'If an account exists for this email, a verification code has been sent to'}
                <br />
                <span className="font-semibold text-foreground">{maskEmail(forgotEmail)}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyResetOtp} className="space-y-5">
              <OtpInput value={forgotOtp} onChange={setForgotOtp} disabled={forgotSubmitting} autoFocus />

              {forgotError && (
                <p className="rounded-[var(--radius-sm)] border border-error/20 bg-error-wash p-3 text-center text-xs font-semibold text-error" role="alert">
                  {forgotError}
                </p>
              )}

              <button
                type="submit"
                disabled={forgotSubmitting || forgotOtp.length !== 6}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {forgotSubmitting && <Loader2 className="animate-spin" size={18} />}
                Verify OTP
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Didn&apos;t receive the code? </span>
              <button
                type="button"
                onClick={handleResendResetOtp}
                disabled={forgotSubmitting || forgotResendCooldown > 0}
                className="font-semibold text-primary transition hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
              >
                {forgotResendCooldown > 0 ? `Resend code in ${forgotResendCooldown}s` : 'Resend OTP'}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={resetForgotPasswordState}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            </div>
          </div>
        ) : forgotStep === 'reset' ? (
          <div className="surface-card p-5 shadow-md sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Create new password</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a new password for your account.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
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
                  value={confirmNewPassword}
                  onChange={setConfirmNewPassword}
                  autoComplete="new-password"
                  required
                />
              </div>

              {forgotError && (
                <p className="rounded-[var(--radius-sm)] border border-error/20 bg-error-wash p-3 text-xs font-semibold text-error" role="alert">
                  {forgotError}
                </p>
              )}

              <button
                type="submit"
                disabled={forgotSubmitting}
                className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {forgotSubmitting && <Loader2 className="animate-spin" size={18} />}
                Reset Password
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={resetForgotPasswordState}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back to login
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="surface-card space-y-4 p-5 shadow-md sm:p-8">
            <div className="space-y-1.5">
              <label className="text-eyebrow">Email Address</label>
              <div className="relative">
                <Mail className={iconClass} size={17} />
                <input type="email" className={inputClass} placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-eyebrow">Password</label>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-xs font-semibold text-primary transition hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                icon={Lock}
                iconClassName={iconClass}
                className={inputClass}
                placeholder="••••••••"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
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
              disabled={loading}
              className="group mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <p className="pt-1 text-center text-sm text-muted-foreground">
              Need access? Your security provider creates your portal account —
              ask your account manager for an invitation.
            </p>
          </form>
        )}

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
