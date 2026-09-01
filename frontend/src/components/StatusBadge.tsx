import React from 'react';
import { cn } from '@/lib/utils';
import { formatEnumLabel } from '@/lib/format';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral';

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success-wash text-success',
  warning: 'bg-warning-wash text-warning',
  error: 'bg-error-wash text-error',
  info: 'bg-info-wash text-info',
  primary: 'bg-primary/8 text-primary',
  neutral: 'bg-muted text-muted-foreground',
};

// Shared mapping from the string statuses used across the app to a tone, so
// pages that don't already have their own colour logic don't have to invent
// one. Unknown values fall back to neutral.
const STATUS_TONES: Record<string, StatusTone> = {
  active: 'success', approved: 'success', paid: 'success', resolved: 'success',
  completed: 'success', verified: 'success', valid: 'success', published: 'success',
  confirmed: 'success', awarded: 'success', synced: 'success', connected: 'success',
  submitted: 'info', sent: 'info', invited: 'info', generated: 'info', issued: 'info',
  in_progress: 'info',
  under_review: 'warning', pending: 'warning', open: 'warning', expiring_soon: 'warning',
  disputed: 'warning',
  draft: 'neutral', not_started: 'neutral', inactive: 'neutral', missing: 'neutral',
  rejected: 'error', cancelled: 'error', expired: 'error', failed: 'error',
  overdue: 'error', blocked: 'error',
  low: 'neutral', medium: 'warning', high: 'error', critical: 'error',
};

export function toneForStatus(status: string): StatusTone {
  return STATUS_TONES[status?.toLowerCase?.().trim()] ?? 'neutral';
}

interface StatusBadgeProps {
  /** Explicit label (pair with `tone`). */
  label?: string;
  /** Raw status string - auto-derives tone + a humanised label unless overridden. */
  status?: string;
  tone?: StatusTone;
  className?: string;
}

// Purely presentational. Two ways to use it:
//   <StatusBadge label="Paid" tone="success" />   (page keeps its own logic)
//   <StatusBadge status={row.status} />            (auto tone + humanised label)
export default function StatusBadge({ label, status, tone, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? (status ? toneForStatus(status) : 'neutral');
  const resolvedLabel = label ?? (status ? formatEnumLabel(status) : '');
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONE_CLASSES[resolvedTone],
        className,
      )}
    >
      {resolvedLabel}
    </span>
  );
}
