'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import {
  downloadDealCalendar,
  getDealFollowUpDraft,
  sendDealFollowUp,
  type FollowUpDraft,
} from '@/lib/sales-delivery';
import { AlertTriangle, CalendarPlus, CheckCircle2, Loader2, Mail, Send } from 'lucide-react';

interface DealOption {
  id: string;
  name: string;
  lead: { name: string; company: string; email?: string | null };
}

export default function SalesDeliveryPage() {
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [dealId, setDealId] = useState('');
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [loading, setLoading] = useState<'data' | 'draft' | 'send' | 'calendar' | null>('data');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDeals = async () => {
      setError('');
      setLoading('data');
      try {
        const res = await api.get('deals');
        setDeals(res.data);
        setDealId(res.data?.[0]?.id || '');
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to load deals.');
      } finally {
        setLoading(null);
      }
    };

    loadDeals();
  }, []);

  const loadDraft = async () => {
    if (!dealId) return;
    setError('');
    setSendResult(null);
    setLoading('draft');
    try {
      setDraft(await getDealFollowUpDraft(dealId));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to generate follow-up draft.');
    } finally {
      setLoading(null);
    }
  };

  const handleSend = async () => {
    if (!dealId) return;
    setError('');
    setLoading('send');
    try {
      setSendResult(await sendDealFollowUp(dealId));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to send follow-up email.');
    } finally {
      setLoading(null);
    }
  };

  const handleCalendar = async () => {
    if (!dealId) return;
    setError('');
    setLoading('calendar');
    try {
      await downloadDealCalendar(dealId, `${draft?.company || 'sales'}-follow-up.ics`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to download calendar invite.');
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    if (dealId) loadDraft();
  }, [dealId]);

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Sales Delivery</h2>
          <p className="text-muted-foreground">Send follow-up emails and export calendar invites for active deals.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleCalendar}
            disabled={!dealId || loading !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {loading === 'calendar' ? <Loader2 size={17} className="animate-spin" /> : <CalendarPlus size={17} />}
            Calendar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft?.to || loading !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading === 'send' ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            Send Email
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {sendResult && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-medium">
            Follow-up sent. Activity created: {sendResult.activityId}
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
              <Mail size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Deal</h3>
              <p className="text-sm text-muted-foreground">Select an active opportunity.</p>
            </div>
          </div>

          <select
            value={dealId}
            onChange={(event) => setDealId(event.target.value)}
            disabled={loading === 'data'}
            className="min-h-11 w-full rounded-lg border border-white/10 bg-[#111827] px-3 text-white outline-none focus:border-indigo-400 disabled:opacity-50"
          >
            {deals.length === 0 && <option value="">No deals available</option>}
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.name} - {deal.lead.company}
              </option>
            ))}
          </select>

          {draft && (
            <div className="mt-5 space-y-3 text-sm">
              <InfoRow label="Recipient" value={draft.to || 'Missing lead email'} tone={draft.to ? 'good' : 'warn'} />
              <InfoRow label="Company" value={draft.company} />
              <InfoRow label="Next activity" value={draft.nextActivity?.subject || 'Generated default checkpoint'} />
            </div>
          )}
        </section>

        <section className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Follow-Up Draft</h3>
              <p className="text-sm text-muted-foreground">Generated from deal assessment, discovery, and next activity.</p>
            </div>
            <button
              type="button"
              onClick={loadDraft}
              disabled={!dealId || loading !== null}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading === 'draft' || loading === 'data' ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">Generating draft...</div>
          ) : !draft ? (
            <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-muted-foreground">
              Select a deal to generate a follow-up draft.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</p>
                <p className="font-semibold text-white">{draft.subject}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Body</p>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-100">{draft.body}</pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-200'
      : tone === 'warn'
        ? 'text-amber-100'
        : 'text-slate-100';

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`break-words font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
