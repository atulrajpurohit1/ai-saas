'use client';

import { formatDate as fmtDate } from '@/lib/format';
import React, { useCallback, useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import {
  User,
  Building,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Info,
  Lock,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import PasswordInput from '@/components/PasswordInput';

interface ClientProfile {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  createdAt: string;
}

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

export default function ClientProfilePage() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Change-password form (self-service, requires the current password).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwSubmitting) return;
    setPwError('');

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await api.post('client-auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      // The backend invalidates other sessions and re-issues tokens for this
      // device; store them so the current session keeps working.
      if (res.data?.access_token)
        localStorage.setItem('client_token', res.data.access_token);
      if (res.data?.refresh_token)
        localStorage.setItem('client_refresh_token', res.data.refresh_token);

      toast.success('Your password has been changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPwError(errorMessageFrom(err, 'Could not change your password. Please try again.'));
    } finally {
      setPwSubmitting(false);
    }
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('client-portal/profile');
      setProfile(res.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch profile', err);
      setError('Could not load your profile. Please refresh or sign in again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const pwInputClass =
    'w-full rounded-[var(--radius)] border border-border bg-card py-3 pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-ring/50';
  const pwIconClass =
    'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground';

  const field = (label: string, icon: React.ReactNode, value: React.ReactNode) => (
    <div className="space-y-1">
      <div className="text-eyebrow">{label}</div>
      <div className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-foreground">
        <span className="text-primary/70">{icon}</span>
        <span className="break-all">{value}</span>
      </div>
    </div>
  );

  return (
    <ClientLayout>
      <PageHeader title="Your Profile" description="Your account and company details." />

      {loading ? (
        <LoadingState label="Loading profile…" />
      ) : error || !profile ? (
        <ErrorState message={error || 'Profile not found.'} onRetry={fetchProfile} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="surface-card p-5 sm:p-8">
              <div className="flex flex-col items-start gap-6 md:flex-row">
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-primary text-primary-foreground shadow-sm sm:h-24 sm:w-24">
                  <User size={40} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-xl font-extrabold text-foreground sm:text-2xl">{profile.name}</h2>
                  <p className="mb-6 mt-1 text-sm font-semibold text-primary">
                    {profile.companyName || 'Private Client'}
                  </p>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {field('Email Address', <Mail size={17} />, profile.email)}
                    {field('Phone Number', <Phone size={17} />, profile.phone || 'Not provided')}
                    {field('Client Since', <Calendar size={17} />, fmtDate(profile.createdAt))}
                    {field('Account Status', <ShieldCheck size={17} className="text-success" />, <span className="font-bold text-success">Verified Client</span>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-[var(--radius-lg)] border border-info/20 bg-info-wash p-5 sm:p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-info/10 text-info">
                <Info size={20} />
              </span>
              <div>
                <h3 className="mb-1 text-card-title">Information Security</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Your profile information is securely managed by your account team. To update admin-only
                  details like your company name or linked email, contact your account manager.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card p-5 sm:p-6">
              <h3 className="mb-5 flex items-center gap-2 text-section-title">
                <Building className="text-primary" size={18} />
                Company Details
              </h3>
              <div className="space-y-4">
                <div className="surface-muted p-4">
                  <div className="text-eyebrow">Account Reference</div>
                  <div className="mt-1 font-mono text-sm text-foreground">
                    ACCT-{profile.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                <div className="surface-muted p-4">
                  <div className="text-eyebrow">Service Type</div>
                  <div className="mt-1 text-sm text-foreground">Premium Security SaaS</div>
                </div>
              </div>
            </div>

            <div className="surface-card p-5 sm:p-6">
              <h3 className="mb-5 flex items-center gap-2 text-section-title">
                <KeyRound className="text-primary" size={18} />
                Change Password
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-eyebrow">Current Password</label>
                  <PasswordInput
                    icon={Lock}
                    iconClassName={pwIconClass}
                    className={pwInputClass}
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-eyebrow">New Password</label>
                  <PasswordInput
                    icon={Lock}
                    iconClassName={pwIconClass}
                    className={pwInputClass}
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
                    iconClassName={pwIconClass}
                    className={pwInputClass}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                    required
                  />
                </div>

                {pwError && (
                  <p className="rounded-[var(--radius-sm)] border border-error/20 bg-error-wash p-3 text-xs font-semibold text-error" role="alert">
                    {pwError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pwSubmitting}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pwSubmitting && <Loader2 className="animate-spin" size={16} />}
                  Update Password
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </ClientLayout>
  );
}
