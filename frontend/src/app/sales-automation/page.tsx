'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCcw,
} from 'lucide-react';
import {
  getSalesAutomationStatus,
  runSalesAutomation,
  type SalesAutomationStatus,
  type SalesAutomationSummary,
} from '@/lib/sales-automation';

export default function SalesAutomationPage() {
  const [status, setStatus] = useState<SalesAutomationStatus | null>(null);
  const [lastRun, setLastRun] = useState<SalesAutomationSummary | null>(null);
  const [loading, setLoading] = useState<'status' | 'run' | null>('status');
  const [error, setError] = useState('');

  const loadStatus = async () => {
    setError('');
    setLoading((current) => current || 'status');
    try {
      const nextStatus = await getSalesAutomationStatus();
      setStatus(nextStatus);
      setLastRun(nextStatus.lastRunSummary);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load automation status.');
    } finally {
      setLoading(null);
    }
  };

  const handleRun = async () => {
    setError('');
    setLoading('run');
    try {
      const summary = await runSalesAutomation();
      setLastRun(summary);
      await loadStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to run sales automation.');
      setLoading(null);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold sm:text-3xl">Sales Automation</h2>
          <p className="text-muted-foreground">Create follow-up tasks for stalled, risky, or under-discovered deals.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCcw size={17} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={loading !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading === 'run' ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
            Run Scan
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="glass-card min-w-0 rounded-lg border border-white/10 p-4 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Automation Loop</h3>
              <p className="text-sm text-muted-foreground">Server-side scheduled scan</p>
            </div>
          </div>

          {loading === 'status' && !status ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading automation status...</div>
          ) : (
            <div className="space-y-4">
              <StatusRow label="Status" value={status?.enabled ? 'Enabled' : 'Disabled'} tone={status?.enabled ? 'good' : 'warn'} />
              <StatusRow label="Cadence" value={`${status?.intervalMinutes || 0} minutes`} />
              <StatusRow label="Running now" value={status?.running ? 'Yes' : 'No'} tone={status?.running ? 'warn' : 'good'} />
              <StatusRow
                label="Last run"
                value={status?.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : 'Not run yet'}
              />
            </div>
          )}

          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4 text-xs leading-5 text-muted-foreground">
            Tasks created by this phase are marked with <span className="font-bold text-slate-200">{status?.marker || '[Sales Automation]'}</span>.
          </div>
        </section>

        <section className="glass-card min-w-0 rounded-lg border border-white/10 p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-bold">Latest Scan</h3>
              <p className="text-sm text-muted-foreground">Deal follow-up task creation summary.</p>
            </div>
            {lastRun && lastRun.errors.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-200">
                <CheckCircle2 size={17} />
                Clean
              </div>
            )}
          </div>

          {!lastRun ? (
            <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-muted-foreground">
              Run a scan to create missing follow-up activities for eligible deals.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Deals scanned" value={lastRun.scannedDeals} icon={<Clock3 size={18} />} />
                <Metric label="Tasks created" value={lastRun.createdActivities} icon={<CheckCircle2 size={18} />} />
                <Metric label="Deals skipped" value={lastRun.skippedDeals} icon={<RefreshCcw size={18} />} />
                <Metric label="Errors" value={lastRun.errors.length} icon={<AlertTriangle size={18} />} />
              </div>

              {lastRun.errors.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="mb-2 text-sm font-bold text-amber-100">Review needed</p>
                  <div className="max-h-52 space-y-1 overflow-y-auto text-sm text-amber-50/90">
                    {lastRun.errors.map((item, index) => (
                      <p key={`${item.dealId || index}-${item.message}`}>
                        {item.dealId ? `${item.dealId}: ` : ''}{item.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
        : 'border-white/10 bg-white/5 text-slate-200';

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`rounded-md border px-2.5 py-1 text-xs font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between text-indigo-300">
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
