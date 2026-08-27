'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react';
import {
  EmergencyAlert,
  getActiveEmergencyAlert,
  triggerEmergencyAlert,
} from '@/lib/emergency-alerts';
import { getApiErrorMessage } from '@/lib/api-error';

const HOLD_DURATION_MS = 1800;

type ButtonState = 'idle' | 'holding' | 'sending' | 'error';

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function GuardPanicButton() {
  const [activeAlert, setActiveAlert] = useState<EmergencyAlert | null>(null);
  const [checkedActive, setCheckedActive] = useState(false);
  const [buttonState, setButtonState] = useState<ButtonState>('idle');
  const [holdProgress, setHoldProgress] = useState(0);

  const holdStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getActiveEmergencyAlert()
      .then((alert) => {
        if (!cancelled) setActiveAlert(alert);
      })
      .catch(() => {
        // Silent - the guard can still trigger a new alert regardless of
        // whether this background check succeeded.
      })
      .finally(() => {
        if (!cancelled) setCheckedActive(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    holdStartRef.current = null;
    setHoldProgress(0);
  }, []);

  const submitAlert = useCallback(async () => {
    setButtonState('sending');
    try {
      const alert = await triggerEmergencyAlert();
      setActiveAlert(alert);
      setButtonState('idle');
      toast.success('Emergency alert sent.');
    } catch (err) {
      setButtonState('error');
      toast.error(getApiErrorMessage(err, 'Could not confirm the alert was sent.'));
    }
  }, []);

  // requestAnimationFrame needs to re-schedule itself; a ref indirection
  // avoids referencing the `tick` binding before it's assigned. The ref is
  // updated in an effect (never during render) per the rules of hooks.
  const tickRef = useRef<() => void>(() => {});
  useEffect(() => {
    tickRef.current = () => {
      if (holdStartRef.current === null) return;
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        clearHold();
        void submitAlert();
        return;
      }
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    };
  }, [clearHold, submitAlert]);

  const startHold = useCallback(() => {
    if (buttonState === 'sending') return;
    setButtonState('holding');
    holdStartRef.current = Date.now();
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, [buttonState]);

  const cancelHold = useCallback(() => {
    if (buttonState !== 'holding') return;
    clearHold();
    setButtonState('idle');
  }, [buttonState, clearHold]);

  useEffect(() => () => clearHold(), [clearHold]);

  if (!checkedActive) {
    return null;
  }

  // An ACTIVE or ACKNOWLEDGED alert already exists for this guard - show its
  // real status instead of offering a fresh trigger (the backend is
  // idempotent either way, but this avoids implying nothing was sent yet).
  if (activeAlert && (activeAlert.status === 'ACTIVE' || activeAlert.status === 'ACKNOWLEDGED')) {
    const acknowledged = activeAlert.status === 'ACKNOWLEDGED';
    return (
      <div
        className={`flex items-center gap-3 border-t px-4 py-3 ${
          acknowledged
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
        }`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${acknowledged ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'}`} />
        <div className="min-w-0 flex-1 text-sm font-semibold">
          {acknowledged
            ? `Dispatch acknowledged your alert${activeAlert.acknowledgedBy?.name ? ` (${activeAlert.acknowledgedBy.name})` : ''} - help is on the way.`
            : 'Emergency alert sent - dispatch has been notified.'}
        </div>
        <span className="shrink-0 text-xs opacity-75">{relativeTime(activeAlert.triggeredAt)}</span>
      </div>
    );
  }

  return (
    <div className="border-t border-rose-500/20 bg-[#0d0303]/95 px-4 py-3">
      <button
        type="button"
        aria-label="Hold for two seconds to send an emergency alert"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        disabled={buttonState === 'sending'}
        className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border border-rose-500/40 bg-rose-950/60 py-3 text-sm font-bold text-rose-200 transition-colors active:bg-rose-900/70 disabled:opacity-70"
      >
        <span
          className="absolute inset-y-0 left-0 bg-rose-600/50 transition-[width] duration-75 ease-linear"
          style={{ width: `${holdProgress}%` }}
        />
        <span className="relative z-10 flex items-center gap-2">
          {buttonState === 'sending' ? (
            <>
              <ShieldAlert size={18} className="animate-pulse" />
              Sending alert...
            </>
          ) : buttonState === 'error' ? (
            <>
              <RotateCcw size={18} />
              Not sent - tap and hold to retry
            </>
          ) : buttonState === 'holding' ? (
            <>
              <AlertTriangle size={18} />
              Keep holding...
            </>
          ) : (
            <>
              <ShieldAlert size={18} />
              Hold for Emergency
            </>
          )}
        </span>
      </button>
      {buttonState === 'error' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-300/80">
          <AlertTriangle size={12} />
          The alert was not confirmed by the server. It was not sent - try again.
        </p>
      )}
      {activeAlert?.status === 'RESOLVED' && buttonState === 'idle' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400/80">
          <CheckCircle2 size={12} />
          Your last alert was marked resolved.
        </p>
      )}
    </div>
  );
}
