'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { EvaluationReport, generateEvaluation, markdownToHtml } from '@/lib/rfp';
import { getRfpSubmissions, InvitationStatus, RfpVendorSubmission } from '@/lib/vendors';
import { AlertTriangle, Loader2, Sparkles, Trophy } from 'lucide-react';

const statusClass: Record<InvitationStatus, string> = {
  PENDING: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  INVITED: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  VIEWED: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  SUBMITTED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface AiEvaluationPanelProps {
  rfpId: string;
  initialEvaluation: EvaluationReport | null;
}

export default function AiEvaluationPanel({ rfpId, initialEvaluation }: AiEvaluationPanelProps) {
  const { can } = useAuth();
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(initialEvaluation);
  const [submissions, setSubmissions] = useState<RfpVendorSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const canEvaluate = can('rfp.evaluate');
  const submittedCount = submissions.filter((item) => item.submission).length;

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const data = await getRfpSubmissions(rfpId);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch {
      // Non-fatal for this panel — the comparison table simply stays empty.
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfpId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const result = await generateEvaluation(rfpId);
      setEvaluation(result);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate the AI evaluation.'));
    } finally {
      setGenerating(false);
    }
  };

  const isRecommended = (companyName: string) =>
    Boolean(
      evaluation?.recommendedVendor &&
        evaluation.recommendedVendor.trim().toLowerCase() === companyName.trim().toLowerCase(),
    );

  return (
    <section className="rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
          <Sparkles size={14} />
          AI Proposal Evaluation
        </h3>
        {canEvaluate && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || submittedCount === 0}
            title={submittedCount === 0 ? 'At least one vendor must submit a proposal first' : undefined}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
            {generating ? 'Generating...' : evaluation ? 'Regenerate Evaluation' : 'Generate Evaluation'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="mb-6 overflow-x-auto">
        <table className="responsive-table w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Vendor</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Proposal Submitted</th>
              <th className="px-4 py-3 font-semibold">Evaluation Result</th>
              <th className="px-4 py-3 font-semibold">Recommended</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loadingSubmissions ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto animate-spin text-indigo-300" size={18} />
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  No vendors have been invited to this RFP yet.
                </td>
              </tr>
            ) : (
              submissions.map((item) => (
                <tr key={item.id} className="transition hover:bg-white/5">
                  <td className="px-4 py-3 font-semibold text-white" data-label="Vendor">
                    {item.vendor.companyName}
                  </td>
                  <td className="px-4 py-3" data-label="Status">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusClass[item.invitationStatus]}`}>
                      {item.invitationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Proposal Submitted">
                    {item.submission ? formatDateTime(item.submittedAt) : 'Not submitted'}
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Evaluation Result">
                    {!item.submission ? '—' : evaluation ? 'Included in evaluation' : 'Pending evaluation'}
                  </td>
                  <td className="px-4 py-3" data-label="Recommended">
                    {isRecommended(item.vendor.companyName) ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                        ⭐ Recommended
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!evaluation ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-muted py-10 text-center text-sm text-slate-500">
          No AI evaluation has been generated for this RFP yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-400">Executive Summary</h4>
              <p className="text-sm text-slate-300">{evaluation.summary}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
                <Trophy size={14} />
                Recommended Vendor
              </h4>
              <p className="text-sm font-semibold text-white">
                {evaluation.recommendedVendor || 'No vendor could be confidently recommended.'}
              </p>
            </div>
          </div>

          <div
            className="rfp-document rounded-2xl border border-white/5 bg-muted"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(evaluation.generatedReport) }}
          />
        </div>
      )}
    </section>
  );
}
