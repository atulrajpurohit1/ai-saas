import api from '@/lib/api';

export interface SecurityStatus {
  email: string;
  recoveryEmail: string | null;
  hasRecoveryEmail: boolean;
  recoveryEmailVerified: boolean;
  twoFactorEnabled: boolean;
}

/** Response from any "start" step that emails a code before completing. */
export interface OtpSentResponse {
  status: 'otp_sent';
  target: string;
}

export async function getSecurityStatus() {
  const res = await api.get<SecurityStatus>('account/security');
  return res.data;
}

export async function startRecoveryEmail(password: string, email: string) {
  const res = await api.post<OtpSentResponse>('account/security/recovery-email/start', {
    password,
    email,
  });
  return res.data;
}

export async function verifyRecoveryEmail(code: string) {
  const res = await api.post<{ status: 'ok'; recoveryEmail: string }>(
    'account/security/recovery-email/verify',
    { code },
  );
  return res.data;
}

export async function removeRecoveryEmail(password: string) {
  const res = await api.delete<{ status: 'ok' }>('account/security/recovery-email', {
    data: { password },
  });
  return res.data;
}

export async function startEnableTwoFactor(password: string) {
  const res = await api.post<OtpSentResponse>('account/security/two-factor/enable/start', {
    password,
  });
  return res.data;
}

export async function verifyEnableTwoFactor(code: string) {
  const res = await api.post<{ status: 'ok'; twoFactorEnabled: boolean }>(
    'account/security/two-factor/enable/verify',
    { code },
  );
  return res.data;
}

export async function disableTwoFactor(password: string) {
  const res = await api.post<{ status: 'ok'; twoFactorEnabled: boolean }>(
    'account/security/two-factor/disable',
    { password },
  );
  return res.data;
}

export interface ChangePasswordResult {
  status: 'otp_required' | 'ok';
  target?: string;
  message?: string;
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  code?: string;
}) {
  const res = await api.post<ChangePasswordResult>('auth/change-password', payload);
  return res.data;
}
