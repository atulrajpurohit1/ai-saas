'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AiFeedbackControl from '@/components/AiFeedbackControl';
import DashboardLayout from '@/components/DashboardLayout';
import {
  approveAiAction,
  executeAiAction,
  getAiActions,
  RecommendationAction,
  RecommendationActionStatus,
  rejectAiAction,
} from '@/lib/ai-actions';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  Play,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

const statuses: RecommendationActionStatus[] = [
  'pending',
  'approved',
  'rejected',
  'executed',
  'failed',
];

const statusStyles: Record<RecommendationActionStatus, string> = {
  pending: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  approved: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  rejected: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
  executed: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  failed: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
};

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatTarget(action: RecommendationAction) {
  if (!action.targetEntityId) return action.targetModule;
  return `${action.targetModule} / ${action.targetEntityId.slice(0, 8)}`;
}

export default function AiActionsPage() {
  const [actions, setActions] = useState<RecommendationAction[]>([]);
  const [summary, setSummary] = useState<Record<RecommendationActionStatus, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
    executed: 0,
    failed: 0,
  });
  const [activeStatus, setActiveStatus] =
    useState<RecommendationActionStatus>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedId) ?? actions[0],
    [actions, selectedId],
  );

  const loadActions = async (status = activeStatus) => {
    setLoading(true);
    try {
      const data = await getAiActions(status);
      setActions(data.actions);
      setSummary(data.summary);
      setSelectedId((current) =>
        current && data.actions.some((action) => action.id === current)
          ? current
          : data.actions[0]?.id ?? null,
      );
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI actions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions(activeStatus);
  }, [activeStatus]);

  const runAction = async (
    id: string,
    operation: (id: string) => Promise<RecommendationAction>,
  ) => {
    setWorkingId(id);
    try {
      const updated = await operation(id);
      setError('');
      await loadActions(updated.status);
      setActiveStatus(updated.status);
      setSelectedId(updated.id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update AI action.'));
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <ShieldCheck className="text-emerald-300" size={30} />
            AI Actions
          </h2>
        </div>
        <button
          type="button"
          onClick={() => loadActions(activeStatus)}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            className={`rounded-2xl border p-4 text-left transition ${
              activeStatus === status
                ? `${statusStyles[status]}`
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider">
              {formatLabel(status)}
            </div>
            <div className="mt-2 text-3xl font-black text-white">
              {summary[status] ?? 0}
            </div>
          </button>
        ))}
      </div>

      {loading && actions.length === 0 ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="mx-auto mb-3 animate-spin text-emerald-300" size={28} />
          Loading AI actions...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section className="space-y-3">
            {actions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-slate-500">
                No {formatLabel(activeStatus)} actions.
              </div>
            ) : (
              actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => setSelectedId(action.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedAction?.id === action.id
                      ? 'border-emerald-400/30 bg-emerald-400/10'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="font-bold text-white">{action.title}</h3>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${statusStyles[action.status]}`}>
                      {formatLabel(action.status)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-slate-400">
                    {action.description}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <ClipboardCheck size={14} />
                    {formatLabel(action.actionType)}
                  </div>
                </button>
              ))
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            {selectedAction ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <span className={`mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusStyles[selectedAction.status]}`}>
                      {formatLabel(selectedAction.status)}
                    </span>
                    <h3 className="text-2xl font-black text-white">{selectedAction.title}</h3>
                    <p className="mt-2 text-sm font-semibold text-slate-400">
                      {formatLabel(selectedAction.actionType)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['pending', 'failed'].includes(selectedAction.status) && (
                      <button
                        type="button"
                        disabled={workingId === selectedAction.id}
                        onClick={() => runAction(selectedAction.id, approveAiAction)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        <CheckCircle2 size={16} />
                        Approve
                      </button>
                    )}
                    {['pending', 'approved', 'failed'].includes(selectedAction.status) && (
                      <button
                        type="button"
                        disabled={workingId === selectedAction.id}
                        onClick={() => runAction(selectedAction.id, rejectAiAction)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-60"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    )}
                    {selectedAction.status === 'approved' && (
                      <button
                        type="button"
                        disabled={workingId === selectedAction.id}
                        onClick={() => runAction(selectedAction.id, executeAiAction)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
                      >
                        <Play size={16} />
                        Execute
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Target</p>
                    <p className="mt-2 break-words text-sm font-semibold text-slate-200">
                      {formatTarget(selectedAction)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Created</p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Clock size={14} />
                      {new Date(selectedAction.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Recommendation Text
                  </h4>
                  <div className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/10 p-5 text-sm leading-7 text-slate-200">
                    {selectedAction.description}
                  </div>
                  <AiFeedbackControl
                    aiGenerationId={selectedAction.aiGenerationId || undefined}
                    recommendationId={selectedAction.recommendationId}
                    actionId={selectedAction.id}
                    compact
                  />
                </div>

                {selectedAction.failureReason && (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm font-semibold text-rose-200">
                    {selectedAction.failureReason}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-24 text-center text-sm text-slate-500">
                Select an AI action.
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
