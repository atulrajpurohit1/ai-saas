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
