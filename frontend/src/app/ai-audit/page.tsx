'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AiAuditRecord,
  approveAiOutput,
  getAiAudit,
  getAiAuditRecord,
} from '@/lib/ai-governance';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileSearch,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

const statusClass: Record<string, string> = {
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  fallback: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  failed: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  passed: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  review_required: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  blocked: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  approved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  not_required: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusClass[value] || statusClass.not_required}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  const text = useMemo(() => JSON.stringify(value ?? null, null, 2), [value]);

  return (
    <pre className="max-h-96 overflow-auto rounded-xl border border-white/10 bg-[#0b1120] p-4 text-xs leading-5 text-slate-300">
      {text}
    </pre>
  );
}

export default function AiAuditPage() {
  const [records, setRecords] = useState<AiAuditRecord[]>([]);
  const [selected, setSelected] = useState<AiAuditRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAudit = async () => {
    setLoading(true);
    try {
      const data = await getAiAudit();
      setRecords(data);
      setError('');
      if (!selected && data[0]) {
        await loadDetail(data[0].id);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI audit records.'));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await getAiAuditRecord(id);
      setSelected(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI audit detail.'));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const handleApprove = async () => {
    if (!selected) return;
    setApproving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await approveAiOutput(selected.id);
      setSelected(updated);
      setRecords((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      setSuccess('AI output approved.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not approve AI output.'));
    } finally {
      setApproving(false);
    }
  };

  const canApprove =
    selected &&
    selected.approvalStatus !== 'approved' &&
    selected.safetyStatus !== 'blocked';

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <FileSearch className="text-sky-300" size={30} />
            AI Audit
          </h2>
          <p className="mt-2 text-slate-400">Generated output lineage, prompt versions, safety status, approvals, and feedback.</p>
        </div>
        <button
          type="button"
          onClick={loadAudit}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-300">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="text-lg font-bold text-white">Generation Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-semibold">Module</th>
                  <th className="px-5 py-4 font-semibold">Prompt</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Safety</th>
                  <th className="px-5 py-4 font-semibold">Approval</th>
                  <th className="px-5 py-4 font-semibold">Created</th>
                  <th className="px-5 py-4 font-semibold text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      Loading AI audit...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      No AI generations logged yet.
                    </td>
                  </tr>
                ) : records.map((record) => (
                  <tr key={record.id} className="text-sm text-slate-300 transition hover:bg-white/5">
                    <td className="px-5 py-4" data-label="Module">
                      <div className="font-bold text-white">{record.sourceModule}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{record.modelUsed}</div>
                    </td>
                    <td className="px-5 py-4" data-label="Prompt">
                      <div className="font-bold text-white">{record.promptVersion}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{record.promptVersionRecord?.promptKey || 'fallback'}</div>
                    </td>
                    <td className="px-5 py-4" data-label="Status">
                      <StatusBadge value={record.fallbackUsed ? 'fallback' : record.status} />
                    </td>
                    <td className="px-5 py-4" data-label="Safety">
                      <StatusBadge value={record.safetyStatus} />
                    </td>
                    <td className="px-5 py-4" data-label="Approval">
                      <StatusBadge value={record.approvalStatus} />
                    </td>
                    <td className="px-5 py-4" data-label="Created">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock size={13} />
                        {new Date(record.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Review">
                      <button
                        type="button"
                        onClick={() => loadDetail(record.id)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                      >
                        <Eye size={15} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Audit Detail</h3>
              {selected && (
                <div className="mt-1 font-mono text-xs text-slate-500">{selected.id}</div>
              )}
            </div>
            {detailLoading && <Loader2 className="animate-spin text-sky-300" size={20} />}
          </div>

          {!selected ? (
            <div className="py-16 text-center text-sm text-slate-500">Select a generation to review.</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Safety</div>
                  <StatusBadge value={selected.safetyStatus} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Approval</div>
                  <StatusBadge value={selected.approvalStatus} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Fallback</div>
                  <div className="text-sm font-bold text-white">{selected.fallbackUsed ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Feedback</div>
                  <div className="text-sm font-bold text-white">
                    {selected.feedbackScore === null ? 'N/A' : selected.feedbackScore} ({selected.feedbackCount})
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Prompt Version</div>
                <div className="text-sm font-bold text-white">{selected.promptVersion}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">
                  {selected.promptVersionRecord
                    ? `${selected.promptVersionRecord.moduleName}/${selected.promptVersionRecord.promptKey}`
                    : selected.sourceModule}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                  {selected.safetyStatus === 'blocked' ? <ShieldAlert className="text-rose-300" size={18} /> : <ShieldCheck className="text-emerald-300" size={18} />}
                  Safety Findings
                </div>
                {selected.safetyFindings.length > 0 ? (
                  <div className="space-y-2">
                    {selected.safetyFindings.map((finding, index) => (
                      <div key={`${finding.rule}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="font-bold text-white">{finding.rule.replace(/_/g, ' ')}</span>
                          <StatusBadge value={finding.severity} />
                        </div>
                        <p className="leading-6 text-slate-400">{finding.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-500">
                    No findings.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleApprove}
                disabled={!canApprove || approving}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {approving ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
                Approve Output
              </button>

              <div>
                <div className="mb-2 text-sm font-bold text-white">Input Source</div>
                <JsonBlock value={selected.inputSource} />
              </div>

              <div>
                <div className="mb-2 text-sm font-bold text-white">Generated Output</div>
                <JsonBlock value={selected.generatedOutput} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </DashboardLayout>
  );
}
