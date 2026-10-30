'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  KeyRound,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  Check,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import OtpInput from '@/components/OtpInput';
import PasswordInput from '@/components/PasswordInput';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  SecurityStatus,
  changePassword,
  disableTwoFactor,
  getSecurityStatus,
  removeRecoveryEmail,
  startEnableTwoFactor,
  startRecoveryEmail,
  verifyEnableTwoFactor,
  verifyRecoveryEmail,
} from '@/lib/account-security';

const cardClass = 'rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6';
const labelClass = 'space-y-2 text-sm font-medium text-muted-foreground';
const pwInputClass =
  'w-full rounded-[var(--radius)] border border-border bg-card py-3 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-ring/50';
const iconClass =
  'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground';

function CardHeader({ icon: Icon, title, description }: { icon: typeof Lock; title: string; description: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/* ------------------------------- Password -------------------------------- */

function ChangePasswordCard() {
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [target, setTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setStep('form');
    setCurrent('');
    setNext('');
    setConfirm('');
    setCode('');
    setTarget('');
    setError('');
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await changePassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });
      if (res.status === 'otp_required') {
        setTarget(res.target || '');
        setStep('otp');
        toast.success('We sent a verification code to confirm this change.');
      } else {
        toast.success('Password changed.');
        reset();
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change your password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || code.length !== 6) return;
    setError('');
    setSubmitting(true);
    try {
      await changePassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
        code,
      });
      toast.success('Password changed.');
      reset();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid verification code.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={cardClass}>
      <CardHeader icon={Lock} title="Password" description="Change the password you use to sign in." />
      {step === 'form' ? (
        <form onSubmit={submitForm} className="space-y-4">
          <label className={labelClass}>
            Current password
            <PasswordInput icon={KeyRound} iconClassName={iconClass} className={pwInputClass} placeholder="••••••••" value={current} onChange={setCurrent} autoComplete="current-password" required />
          </label>
          <label className={labelClass}>
            New password
            <PasswordInput icon={Lock} iconClassName={iconClass} className={pwInputClass} placeholder="At least 8 characters" value={next} onChange={setNext} autoComplete="new-password" required />
          </label>
          <label className={labelClass}>
            Confirm new password
            <PasswordInput icon={Lock} iconClassName={iconClass} className={pwInputClass} placeholder="Re-enter new password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />
          </label>
          {error && <p className="text-sm font-medium text-error">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" size={16} />}
            Update password
          </Button>
        </form>
      ) : (
        <form onSubmit={submitOtp} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code we sent to <span className="font-semibold text-foreground">{target}</span> to confirm this change.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
          {error && <p className="text-center text-sm font-medium text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting || code.length !== 6}>
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Confirm change
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ---------------------------- Recovery email ----------------------------- */

function RecoveryEmailCard({ status, onChanged }: { status: SecurityStatus; onChanged: () => void }) {
  const [mode, setMode] = useState<'idle' | 'form' | 'otp' | 'remove'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [target, setTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setMode('idle');
    setEmail('');
    setPassword('');
    setCode('');
    setTarget('');
    setError('');
  };

  const submitStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await startRecoveryEmail(password, email.trim());
      setTarget(res.target);
      setMode('otp');
      toast.success('We sent a verification code to the new address.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send a verification code.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || code.length !== 6) return;
    setError('');
    setSubmitting(true);
    try {
      await verifyRecoveryEmail(code);
      toast.success('Recovery email verified.');
      reset();
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid verification code.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await removeRecoveryEmail(password);
      toast.success('Recovery email removed.');
      reset();
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove the recovery email.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={cardClass}>
      <CardHeader
        icon={Mail}
        title="Recovery email"
        description="A second address for verification codes and security alerts."
      />

      {status.hasRecoveryEmail && mode === 'idle' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4">
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{status.recoveryEmail}</div>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-success">
              <Check size={13} /> Verified
            </span>
          </div>
        </div>
      )}

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setMode('form')}>
            {status.hasRecoveryEmail ? 'Change recovery email' : 'Add recovery email'}
          </Button>
          {status.hasRecoveryEmail && (
            <Button type="button" variant="outline" onClick={() => setMode('remove')} className="text-error">
              <Trash2 size={15} /> Remove
            </Button>
          )}
        </div>
      )}

      {mode === 'form' && (
        <form onSubmit={submitStart} className="space-y-4">
          <label className={labelClass}>
            New recovery email
            <div className="relative">
              <Mail className={iconClass} size={17} />
              <input type="email" className={pwInputClass} placeholder="backup@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
          </label>
          <label className={labelClass}>
            Your password
            <PasswordInput icon={KeyRound} iconClassName={iconClass} className={pwInputClass} placeholder="••••••••" value={password} onChange={setPassword} autoComplete="current-password" required />
          </label>
          {error && <p className="text-sm font-medium text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Send code
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>Cancel</Button>
          </div>
        </form>
      )}

      {mode === 'otp' && (
        <form onSubmit={submitVerify} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code we sent to <span className="font-semibold text-foreground">{target}</span>.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
          {error && <p className="text-center text-sm font-medium text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting || code.length !== 6}>
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Verify
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>Cancel</Button>
          </div>
        </form>
      )}

      {mode === 'remove' && (
        <form onSubmit={submitRemove} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your password to remove <span className="font-semibold text-foreground">{status.recoveryEmail}</span> as your recovery email.
          </p>
          <label className={labelClass}>
            Your password
            <PasswordInput icon={KeyRound} iconClassName={iconClass} className={pwInputClass} placeholder="••••••••" value={password} onChange={setPassword} autoComplete="current-password" required />
          </label>
          {error && <p className="text-sm font-medium text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting} className="bg-error text-white hover:bg-error/90">
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Remove recovery email
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ---------------------------- Two-step verify ---------------------------- */

function TwoFactorCard({ status, onChanged }: { status: SecurityStatus; onChanged: () => void }) {
  const [mode, setMode] = useState<'idle' | 'enable-password' | 'enable-otp' | 'disable'>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [target, setTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setMode('idle');
    setPassword('');
    setCode('');
    setTarget('');
    setError('');
  };

  const submitEnableStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await startEnableTwoFactor(password);
      setTarget(res.target);
      setMode('enable-otp');
      toast.success('We sent a verification code to confirm.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start two-step verification.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitEnableVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || code.length !== 6) return;
    setError('');
    setSubmitting(true);
    try {
      await verifyEnableTwoFactor(code);
      toast.success('Two-step verification is on.');
      reset();
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid verification code.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await disableTwoFactor(password);
      toast.success('Two-step verification is off.');
      reset();
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not turn off two-step verification.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={cardClass}>
      <CardHeader
        icon={ShieldCheck}
        title="Two-step verification"
        description="Require an emailed code at sign-in and for sensitive changes."
      />

      <div className="mb-4 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            status.twoFactorEnabled ? 'bg-success-wash text-success' : 'bg-muted text-muted-foreground'
          }`}
        >
          {status.twoFactorEnabled ? 'On' : 'Off'}
        </span>
        <span className="text-sm text-muted-foreground">
          Codes go to your {status.recoveryEmailVerified ? 'recovery email' : 'main email'}.
        </span>
      </div>

      {mode === 'idle' && (
        <>
          {status.twoFactorEnabled ? (
            <Button type="button" variant="outline" onClick={() => setMode('disable')}>Turn off</Button>
          ) : (
            <Button type="button" onClick={() => setMode('enable-password')}>Turn on</Button>
          )}
        </>
      )}

      {mode === 'enable-password' && (
        <form onSubmit={submitEnableStart} className="space-y-4">
          <label className={labelClass}>
            Your password
            <PasswordInput icon={KeyRound} iconClassName={iconClass} className={pwInputClass} placeholder="••••••••" value={password} onChange={setPassword} autoComplete="current-password" required />
          </label>
          {error && <p className="text-sm font-medium text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Send code
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>Cancel</Button>
          </div>
        </form>
      )}

      {mode === 'enable-otp' && (
        <form onSubmit={submitEnableVerify} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code we sent to <span className="font-semibold text-foreground">{target}</span>.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
          {error && <p className="text-center text-sm font-medium text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting || code.length !== 6}>
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Turn on
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>Cancel</Button>
          </div>
        </form>
      )}

      {mode === 'disable' && (
        <form onSubmit={submitDisable} className="space-y-4">
          <p className="text-sm text-muted-foreground">Enter your password to turn off two-step verification.</p>
          <label className={labelClass}>
            Your password
            <PasswordInput icon={KeyRound} iconClassName={iconClass} className={pwInputClass} placeholder="••••••••" value={password} onChange={setPassword} autoComplete="current-password" required />
          </label>
          {error && <p className="text-sm font-medium text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting} className="bg-error text-white hover:bg-error/90">
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Turn off
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}

/* --------------------------------- Page ---------------------------------- */

export default function SecuritySettingsPage() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setStatus(await getSecurityStatus());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your security settings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardLayout>
      <PageHeader
        title="Security"
        description="Manage your password, recovery email, and two-step verification."
      />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {loading || !status ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Loading security settings..." />
        </div>
      ) : (
        <div className="grid max-w-3xl gap-6">
          <ChangePasswordCard />
          <RecoveryEmailCard status={status} onChanged={load} />
          <TwoFactorCard status={status} onChanged={load} />
        </div>
      )}
    </DashboardLayout>
  );
}
