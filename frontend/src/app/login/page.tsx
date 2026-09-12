'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Lock, Mail, Building2, User, Shield, Briefcase, Loader2, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import PasswordInput from '@/components/PasswordInput';
import OtpInput from '@/components/OtpInput';
import { toast } from 'sonner';

interface ApiError {
  response?: {
    data?: {
      message?: string | string[];
    };
    status?: number;
  };
}

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const errorMessageFrom = (err: unknown, fallback: string) => {
  const message = (err as ApiError).response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
};

/** Masks an email for display during OTP verification, e.g. "j***@gmail.com". */
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
};

const RESEND_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [role, setRole] = useState<'admin' | 'client'>('admin');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const slugLabel = 'Company Name';
  const slugPlaceholder = 'Acme Security';

  // Post-signup OTP verification step. `pendingEmail` set means the signup
  // request succeeded and we're now waiting on the 6-digit code.
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Forgot-password flow (admin only). Kept as its own small state machine,
  // separate from the signup-OTP state above, since the two flows are never
  // active at the same time but do share the OtpInput/resend-cooldown UX.
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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSubmitting) return;
    setForgotError('');
    setForgotSubmitting(true);

    try {
      const res = await api.post('auth/forgot-password', { email: forgotEmail.trim() });
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
      const res = await api.post('auth/verify-reset-otp', {
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
          status === 429 ? 'Too many attempts. Please try again later.' : 'Invalid verification code.',
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
      await api.post('auth/forgot-password', { email: forgotEmail.trim() });
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
      await api.post('auth/reset-password', {
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

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (role === 'admin') {
        if (isRegister) {
          localStorage.removeItem('client_token');
          localStorage.removeItem('client_refresh_token');
          localStorage.removeItem('guard_token');
          await api.post('auth/register', {
            name: name || 'Admin',
            email,
            password,
            tenantName,
          });
          setPendingEmail(email);
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
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
          const normalizedTenantSlug = normalizeSlug(tenantSlug);
          setTenantSlug(normalizedTenantSlug);
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          localStorage.removeItem('guard_token');
          await api.post('client-auth/register', {
            name,
            email,
            password,
            tenantSlug: normalizedTenantSlug,
          });
          setPendingEmail(email);
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
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
      setError(errorMessageFrom(err, 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const verifyEndpoint = role === 'admin' ? 'auth/verify-email' : 'client-auth/verify-email';
  const resendEndpoint = role === 'admin' ? 'auth/resend-otp' : 'client-auth/resend-otp';

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying || otp.length !== 6) return;
    setOtpError('');
    setVerifying(true);

    try {
      const res = await api.post(verifyEndpoint, { email: pendingEmail, code: otp });

      toast.success('Email verified successfully.');

      if (role === 'admin') {
        await completeAdminLogin(res.data.access_token, res.data.refresh_token, name || 'Admin', tenantName);
      } else {
        localStorage.setItem('client_token', res.data.access_token);
        if (res.data.refresh_token) localStorage.setItem('client_refresh_token', res.data.refresh_token);
        router.push('/client/dashboard');
      }
    } catch (err: unknown) {
      const status = (err as ApiError).response?.status;
      setOtpError(
        errorMessageFrom(
          err,
          status === 429 ? 'Too many attempts. Please try again later.' : 'Invalid verification code.',
        ),
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resending || resendCooldown > 0) return;
    setOtpError('');
    setResending(true);

    try {
      await api.post(resendEndpoint, { email: pendingEmail });
      setOtp('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('A new verification code has been sent.');
    } catch (err: unknown) {
      const status = (err as ApiError).response?.status;
      if (status === 429) {
        setOtpError(errorMessageFrom(err, 'Please wait before requesting another code.'));
      } else {
        toast.error(errorMessageFrom(err, 'Could not resend the code. Please try again.'));
      }
    } finally {
      setResending(false);
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
          <Image
            src="/brand/aegislead-logo-light.svg"
            alt="AegisLead — Find Leads. Engage. Convert. Grow."
            width={310}
            height={95}
            priority
          />
        </div>

        {forgotStep === 'email' ? (
          <div className="surface-card p-5 shadow-md sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <KeyRound size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Forgot password</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your registered email address and we&apos;ll send you a verification code.
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
                <p
                  className="rounded-[var(--radius-sm)] border border-error/20 bg-error-wash p-3 text-center text-xs font-semibold text-error"
                  role="alert"
                >
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
          </div>
        ) : pendingEmail ? (
          <div className="surface-card p-5 shadow-md sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Verify your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ve sent a 6-digit verification code to
                <br />
                <span className="font-semibold text-foreground">{maskEmail(pendingEmail)}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <OtpInput value={otp} onChange={setOtp} disabled={verifying} autoFocus />

              {otpError && (
                <p
                  className="rounded-[var(--radius-sm)] border border-error/20 bg-error-wash p-3 text-center text-xs font-semibold text-error"
                  role="alert"
                >
                  {otpError}
                </p>
              )}

              <button
                type="submit"
                disabled={verifying || otp.length !== 6}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {verifying && <Loader2 className="animate-spin" size={18} />}
                Verify Email
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Didn&apos;t receive the code? </span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending || resendCooldown > 0}
                className="font-semibold text-primary transition hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
              >
                {resending
                  ? 'Sending…'
                  : resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend Code'}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setPendingEmail('');
                  setOtp('');
                  setOtpError('');
                }}
                className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
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

            {isRegister && role === 'client' && (
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
              <div className="flex items-center justify-between">
                <label className="text-eyebrow">Password</label>
                {!isRegister && role === 'admin' && (
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs font-semibold text-primary transition hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput
                icon={Lock}
                iconClassName={iconClass}
                className={inputClass}
                placeholder="••••••••"
                value={password}
                onChange={setPassword}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-eyebrow">Confirm Password</label>
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
            )}

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
        )}

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
