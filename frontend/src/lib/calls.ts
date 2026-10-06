import api from '@/lib/api';

export const CALL_OUTCOMES = [
  'dialed',
  'connected',
  'no_answer',
  'voicemail',
  'wrong_number',
  'failed',
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  dialed: 'Dialed',
  connected: 'Connected',
  no_answer: 'No answer',
  voicemail: 'Voicemail',
  wrong_number: 'Wrong number',
  failed: 'Failed',
};

export interface CallRecord {
  id: string;
  phoneNumber: string;
  direction: string;
  outcome: CallOutcome;
  durationSec: number | null;
  notes: string | null;
  transcript: string | null;
  leadId: string | null;
  dealId: string | null;
  hasRecording: boolean;
  recordingFileName: string | null;
  recordingMimeType: string | null;
  recordingSizeBytes: number | null;
  recordingDurationSec: number | null;
  recordedAt: string | null;
  createdAt: string;
  lead?: { id: string; name: string; company: string } | null;
  deal?: { id: string; name: string } | null;
}

export async function logCall(payload: {
  phoneNumber: string;
  leadId?: string;
  dealId?: string;
  outcome?: CallOutcome;
  durationSec?: number;
  notes?: string;
}) {
  const res = await api.post<CallRecord>('calls', payload);
  return res.data;
}

export async function listCalls(params: {
  leadId?: string;
  dealId?: string;
  limit?: number;
  hasRecording?: boolean;
} = {}) {
  const res = await api.get<CallRecord[]>('calls', { params });
  return res.data;
}

export async function updateCall(
  id: string,
  payload: {
    outcome?: CallOutcome;
    durationSec?: number;
    notes?: string;
    transcript?: string;
  },
) {
  const res = await api.patch<CallRecord>(`calls/${id}`, payload);
  return res.data;
}

/** Uploads the audio recorded during a call; replaces any earlier recording. */
export async function uploadCallRecording(id: string, file: File, durationSec?: number) {
  const formData = new FormData();
  formData.append('file', file);
  if (durationSec !== undefined) formData.append('durationSec', String(durationSec));
  const res = await api.post<CallRecord>(`calls/${id}/recording`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // A long call is a large file on a rep's upstream; the default 25s
    // timeout would fail it part-way.
    timeout: 10 * 60 * 1000,
  });
  return res.data;
}

/**
 * Fetches a recording as a Blob. The endpoint needs the bearer token, which an
 * <audio src> cannot send, so playback goes through an object URL.
 */
export async function fetchCallRecording(id: string) {
  const res = await api.get<Blob>(`calls/${id}/recording`, {
    responseType: 'blob',
    timeout: 5 * 60 * 1000,
  });
  return res.data;
}

/** Deletes a call's recording; the call itself stays in the log. */
export async function deleteCallRecording(id: string) {
  const res = await api.delete<CallRecord>(`calls/${id}/recording`);
  return res.data;
}

/**
 * Reads an audio file's length in the browser, for recordings attached from a
 * phone where nothing measured the call. Undefined when the browser cannot
 * decode the format (AMR, for one) -- the length is a nicety, not required.
 */
export function readAudioDurationSec(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value?: number) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = window.setTimeout(() => done(), 5000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () =>
      done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : undefined);
    audio.onerror = () => done();
    audio.src = url;
  });
}

/** What the attach picker accepts: the formats phone dialers save. */
export const CALL_RECORDING_ACCEPT =
  'audio/*,.m4a,.mp3,.wav,.aac,.amr,.3gp,.3gpp,.ogg,.opus,.webm,.mp4';

export async function deleteCall(id: string) {
  const res = await api.delete(`calls/${id}`);
  return res.data;
}

/**
 * Formats a number for a tel: URI. The backend normalises to E.164 when the
 * call is logged, but the link is built client-side and must not wait on that
 * round-trip, so it strips the characters a dialer cannot parse.
 */
export function toTelHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function formatDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
