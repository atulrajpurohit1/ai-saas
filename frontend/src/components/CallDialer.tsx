'use client';

import React, { useEffect, useState } from 'react';
import {
  CALL_OUTCOMES,
  CALL_OUTCOME_LABELS,
  formatDuration,
  listCalls,
  logCall,
  toTelHref,
  updateCall,
  type CallOutcome,
  type CallRecord,
} from '@/lib/calls';
import { AlertTriangle, Phone, PhoneOutgoing, Loader2, History } from 'lucide-react';

/**
 * Click-to-dial panel.
 *
 * The app does not carry the call: clicking Call opens the operating system's
 * dialer via a tel: link and the rep talks on their own phone or softphone.
 * Because of that the UI must never imply it knows what happened on the line --
 * it logs that a dial was started, then asks the rep for the outcome. Anything
 * resembling live call state here would be a lie.
 */
export default function CallDialer({
  leadId,
  dealId,
  defaultPhone,
  contactLabel,
  onCallLogged,
}: {
  leadId?: string;
  dealId?: string;
  defaultPhone?: string | null;
  contactLabel?: string;
  onCallLogged?: (call: CallRecord) => void;
}) {
  const [phone, setPhone] = useState(defaultPhone || '');
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome>('connected');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPhone(defaultPhone || '');
  }, [defaultPhone]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!leadId && !dealId) {
        setHistory([]);
        return;
      }
      try {
        const rows = await listCalls({ leadId, dealId, limit: 10 });
        if (!cancelled) setHistory(rows);
      } catch {
        // History is supporting detail; failing to load it must not block dialing.
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [leadId, dealId, activeCall?.id]);

  const startCall = async () => {
    if (!phone.trim()) return;
    setError('');
    setBusy(true);
    try {
      // Log first, then open the dialer. If logging fails the rep is told before
      // the call starts, rather than discovering afterwards that an otherwise
      // good call was never recorded.
      const call = await logCall({ phoneNumber: phone.trim(), leadId, dealId });
      setActiveCall(call);
      setOutcome('connected');
      setDuration('');
      setNotes('');
      onCallLogged?.(call);
      window.location.href = toTelHref(call.phoneNumber);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not start the call.');
    } finally {
      setBusy(false);
    }
  };

  const saveOutcome = async () => {
    if (!activeCall) return;
    setError('');
    setBusy(true);
    try {
      // The rep types minutes because that is how people describe a call; the
      // record stores seconds.
      const parsed = duration.trim() ? Number(duration.trim()) : undefined;
      const updated = await updateCall(activeCall.id, {
        outcome,
        ...(parsed !== undefined && Number.isFinite(parsed) && parsed >= 0
          ? { durationSec: Math.round(parsed * 60) }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setHistory((rows) => [updated, ...rows.filter((row) => row.id !== updated.id)]);
      setActiveCall(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save the call outcome.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-primary/8 text-primary">
          <Phone size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold">Call</h3>
          <p className="truncate text-sm text-muted-foreground">
            {contactLabel ? `Dial ${contactLabel}` : 'Dial from your phone and log the outcome.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border bg-error-wash p-3 text-sm text-rose-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+14155551234"
            inputMode="tel"
            className="min-h-11 w-full rounded-lg border border-border bg-muted px-3 text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={startCall}
            disabled={!phone.trim() || busy}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <PhoneOutgoing size={18} />}
            Call
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Opens your phone or softphone. The call is not recorded here, so upload the
          audio below if you want it transcribed and coached.
        </p>

        {activeCall && (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-bold">How did the call to {activeCall.phoneNumber} go?</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as CallOutcome)}
                className="min-h-11 w-full rounded-lg border border-border bg-muted px-3 text-foreground outline-none focus:border-primary"
              >
                {CALL_OUTCOMES.map((value) => (
                  <option key={value} value={value}>
                    {CALL_OUTCOME_LABELS[value]}
                  </option>
                ))}
              </select>
              <input
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="Minutes"
                inputMode="decimal"
                className="min-h-11 w-full rounded-lg border border-border bg-muted px-3 text-foreground outline-none focus:border-primary sm:w-36"
              />
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Call notes (optional)"
              rows={3}
              className="w-full rounded-lg border border-border bg-muted p-3 text-foreground outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveOutcome}
                disabled={busy}
                className="min-h-11 rounded-lg bg-primary px-4 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                Save outcome
              </button>
              <button
                type="button"
                onClick={() => setActiveCall(null)}
                disabled={busy}
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 px-4 font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <History size={14} />
              Recent calls
            </div>
            <ul className="space-y-2 text-sm">
              {history.map((call) => (
                <li key={call.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-slate-100">{call.phoneNumber}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {CALL_OUTCOME_LABELS[call.outcome] || call.outcome}
                    {call.durationSec !== null && ` - ${formatDuration(call.durationSec)}`}
                    {` - ${new Date(call.createdAt).toLocaleDateString()}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
