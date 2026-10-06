'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  CALL_OUTCOMES,
  CALL_OUTCOME_LABELS,
  formatDuration,
  listCalls,
  logCall,
  toTelHref,
  updateCall,
  uploadCallRecording,
  type CallOutcome,
  type CallRecord,
} from '@/lib/calls';
import { isMobileDevice, useCallRecorder, type FinishedRecording } from '@/lib/use-call-recorder';
import CallRecordingPlayer from '@/components/CallRecordingPlayer';
import AttachCallRecording from '@/components/AttachCallRecording';
import { AlertTriangle, CheckCircle2, Phone, PhoneOutgoing, Loader2, History, Mic, Square, RotateCw } from 'lucide-react';

const subscribeNever = () => () => {};

/**
 * Click-to-dial panel.
 *
 * The app does not carry the call: clicking Call opens the operating system's
 * dialer via a tel: link and the rep talks on their own phone or softphone.
 * Because of that the UI must never imply it knows what happened on the line --
 * it logs that a dial was started, then asks the rep for the outcome. Anything
 * resembling live call state here would be a lie.
 *
 * On a computer, recording starts automatically with the dial, from this
 * device's microphone (see useCallRecorder for what that can and cannot hear),
 * and is uploaded to the call record when the rep stops it or saves the
 * outcome. On a phone the dialer owns the microphone during the call, so the
 * page does not record; the rep attaches the recording their phone's dialer
 * made instead.
 */
export default function CallDialer({
  leadId,
  dealId,
  defaultPhone,
  contactLabel,
  onCallLogged,
  onRecordingSaved,
  onRecordingDeleted,
  refreshKey,
}: {
  leadId?: string;
  dealId?: string;
  defaultPhone?: string | null;
  contactLabel?: string;
  onCallLogged?: (call: CallRecord) => void;
  /** Fires once a recording is stored, with the local file so the page can
   *  transcribe it without downloading it again. */
  onRecordingSaved?: (call: CallRecord, file: File) => void;
  onRecordingDeleted?: (call: CallRecord) => void;
  /** Bump to reload the recent-calls list after a change made elsewhere. */
  refreshKey?: number;
}) {
  // Read on the client only; the server render assumes a computer.
  const mobile = useSyncExternalStore(subscribeNever, isMobileDevice, () => false);
  const [phone, setPhone] = useState(defaultPhone || '');
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome>('connected');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const recorder = useCallRecorder();
  /** The call the microphone is currently recording, if any. */
  const [recordingCall, setRecordingCall] = useState<CallRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  /** Audio whose upload failed, kept so it is not lost and can be retried. */
  const [pendingUpload, setPendingUpload] = useState<{ call: CallRecord; recording: FinishedRecording } | null>(null);
  const [recordingNotice, setRecordingNotice] = useState('');

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
  }, [leadId, dealId, activeCall?.id, refreshKey]);

  const replaceInHistory = (updated: CallRecord) => {
    setHistory((rows) =>
      rows.some((row) => row.id === updated.id)
        ? rows.map((row) => (row.id === updated.id ? updated : row))
        : rows,
    );
  };

  const handleAttached = (updated: CallRecord, file: File) => {
    replaceInHistory(updated);
    if (activeCall?.id === updated.id) setActiveCall(updated);
    setError('');
    setRecordingNotice('Recording saved.');
    onRecordingSaved?.(updated, file);
  };

  const handleRecordingDeleted = (updated: CallRecord) => {
    replaceInHistory(updated);
    if (activeCall?.id === updated.id) setActiveCall(updated);
    setRecordingNotice('');
    onRecordingDeleted?.(updated);
  };

  const uploadRecording = async (call: CallRecord, recording: FinishedRecording) => {
    setUploading(true);
    setRecordingNotice('');
    try {
      const updated = await uploadCallRecording(call.id, recording.file, recording.durationSec);
      setPendingUpload(null);
      replaceInHistory(updated);
      setRecordingNotice(`Recording saved (${formatDuration(recording.durationSec)}).`);
      onRecordingSaved?.(updated, recording.file);
    } catch (err: any) {
      setPendingUpload({ call, recording });
      setError(err?.response?.data?.message || 'The recording could not be uploaded. Retry before leaving this page.');
    } finally {
      setUploading(false);
    }
  };

  /** Stops the microphone and uploads what it captured. Safe to call when idle. */
  const finishRecording = async () => {
    const call = recordingCall;
    if (!call) return null;
    const recording = await recorder.stop(`call-${call.id}`);
    setRecordingCall(null);
    if (!recording) return null;
    // The recorder measured the call, so offer that instead of a blank field.
    if (activeCall?.id === call.id && !duration.trim()) {
      setDuration((recording.durationSec / 60).toFixed(1));
    }
    await uploadRecording(call, recording);
    return recording;
  };

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
      setRecordingNotice('');
      onCallLogged?.(call);

      // Recording before the dialer opens, so the start of the call is not
      // lost. A refused microphone must not stop the rep from calling. Not on
      // a phone: it would record the ringing and then silence.
      if (!mobile && (await recorder.start())) {
        setRecordingCall(call);
      }
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
      // Saving the outcome means the call is over.
      const recording = recordingCall?.id === activeCall.id ? await finishRecording() : null;

      // The rep types minutes because that is how people describe a call; the
      // record stores seconds. Left blank, the recorder's measurement stands in.
      const parsed = duration.trim()
        ? Number(duration.trim())
        : recording
          ? recording.durationSec / 60
          : undefined;
      const updated = await updateCall(activeCall.id, {
        outcome,
        ...(parsed !== undefined && Number.isFinite(parsed) && parsed >= 0
          ? { durationSec: Math.round(parsed * 60) }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setHistory((rows) => {
        // The recording upload above may have landed first; keep its flag.
        const existing = rows.find((row) => row.id === updated.id);
        const merged = existing?.hasRecording ? { ...updated, hasRecording: true } : updated;
        return [merged, ...rows.filter((row) => row.id !== updated.id)];
      });
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
            disabled={!phone.trim() || busy || recorder.status === 'recording' || uploading}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <PhoneOutgoing size={18} />}
            Call
          </button>
        </div>

        {mobile ? (
          <p className="text-xs text-muted-foreground">
            Opens your phone&apos;s dialer. Phones do not let websites record calls, so turn
            on call recording in your dialer&apos;s settings, then attach that recording here
            after you hang up to save both sides of the call.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Opens your phone or softphone and starts recording through this device&apos;s
            microphone. Use speakerphone or a softphone on this computer so both sides
            are captured; a call on a separate handset only records your side.
          </p>
        )}

        {recorder.status === 'recording' && recordingCall && (
          <div className="flex flex-col gap-3 rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
              </span>
              <div>
                <p className="text-sm font-bold">Recording {formatDuration(recorder.elapsedSec)}</p>
                <p className="text-xs text-muted-foreground">Call to {recordingCall.phoneNumber}. Keep this tab open.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={finishRecording}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 text-sm font-bold text-white transition hover:bg-rose-400"
            >
              <Square size={14} />
              Stop &amp; save
            </button>
          </div>
        )}

        {recorder.status === 'requesting' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mic size={14} />
            Allow microphone access to record this call.
          </div>
        )}

        {(recorder.status === 'denied' || recorder.status === 'unsupported') && (
          <div className="flex items-start gap-2 rounded-lg border bg-error-wash p-3 text-xs text-rose-100">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {recorder.status === 'denied'
                ? 'Microphone access was blocked, so this call is not being recorded. Allow the microphone for this site to record the next one.'
                : 'This browser cannot record audio, so this call is not being recorded.'}
            </span>
          </div>
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Uploading recording...
          </div>
        )}

        {pendingUpload && !uploading && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-error-wash p-3 text-xs text-rose-100">
            <span>The recording has not been saved yet.</span>
            <button
              type="button"
              onClick={() => uploadRecording(pendingUpload.call, pendingUpload.recording)}
              className="inline-flex min-h-8 items-center gap-1 rounded-md bg-primary px-3 font-bold text-white"
            >
              <RotateCw size={12} />
              Retry upload
            </button>
          </div>
        )}

        {recordingNotice && !uploading && (
          <div className="rounded-lg border bg-success-wash p-3 text-xs text-emerald-100">{recordingNotice}</div>
        )}

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
            {activeCall.hasRecording ? (
              <div className="flex items-center gap-2 text-xs text-emerald-200">
                <CheckCircle2 size={14} />
                Recording attached to this call.
              </div>
            ) : (
              recordingCall?.id !== activeCall.id && (
                <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-muted-foreground">
                    {mobile
                      ? 'Attach the recording your phone saved for this call. It is usually in your dialer\'s recordings, or under Recordings / Call in your files.'
                      : 'Recorded this call somewhere else? Attach the audio here.'}
                  </p>
                  <AttachCallRecording call={activeCall} label="Attach call recording" onSaved={handleAttached} />
                </div>
              )
            )}
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
            <ul className="space-y-3 text-sm">
              {history.map((call) => (
                <li key={call.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-foreground">
                      {call.hasRecording && <Mic size={12} className="shrink-0 text-primary" />}
                      {call.phoneNumber}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {CALL_OUTCOME_LABELS[call.outcome] || call.outcome}
                      {call.durationSec !== null && ` - ${formatDuration(call.durationSec)}`}
                      {` - ${new Date(call.createdAt).toLocaleDateString()}`}
                    </span>
                  </div>
                  {call.hasRecording ? (
                    <CallRecordingPlayer
                      callId={call.id}
                      fileName={call.recordingFileName}
                      onDeleted={handleRecordingDeleted}
                    />
                  ) : (
                    call.id !== recordingCall?.id && (
                      <AttachCallRecording call={call} onSaved={handleAttached} />
                    )
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
