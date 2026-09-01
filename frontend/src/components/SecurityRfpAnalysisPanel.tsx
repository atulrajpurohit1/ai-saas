'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  RfpRequirementAnalysis,
  SECURITY_RFP_CATEGORY_LABELS,
  SecurityRfpImportance,
  analyzeRfpRequirements,
  generateProposalFromRfp,
  getRfpRequirementAnalysis,
} from '@/lib/rfp';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  FileText,
  HelpCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface Props {
  rfpId: string;
}

const importanceBadge: Record<SecurityRfpImportance, string> = {
  mandatory: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  preferred: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  informational: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SecurityRfpAnalysisPanel({ rfpId }: Props) {
  const { can } = useAuth();
  const canAnalyze = can('rfp.evaluate');
  const canCreateProposal = can('proposals.create');

  const [analysis, setAnalysis] = useState<RfpRequirementAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<{
    proposalId: string;
    placeholders: string[];
    safetyStatus: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    getRfpRequirementAnalysis(rfpId)
      .then((data) => {
        if (active) setAnalysis(data);
      })
      .catch(() => {
        /* no analysis yet is a normal state */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rfpId]);

  const grouped = useMemo(() => {
    const map = new Map<string, RfpRequirementAnalysis['requirements']>();
    (analysis?.requirements ?? []).forEach((req) => {
      const list = map.get(req.category) ?? [];
      list.push(req);
      map.set(req.category, list);
    });
    return Array.from(map.entries());
  }, [analysis]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    setGenerated(null);
    try {
      setAnalysis(await analyzeRfpRequirements(rfpId));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not analyze this RFP.'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateProposal = async () => {
    setGenerating(true);
    setError('');
    try {
      const result = await generateProposalFromRfp(rfpId);
      setGenerated({
        proposalId: result.proposal.id,
        placeholders: result.unresolvedPlaceholders,
        safetyStatus: result.safetyStatus,
      });
      if (result.analysisId && !analysis) {
        setAnalysis(await getRfpRequirementAnalysis(rfpId));
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate a proposal from this RFP.'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
            <ShieldCheck size={14} />
            Security Requirement Analysis
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Extract security-specific requirements from this RFP, then generate a grounded draft proposal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAnalyze && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || generating}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              {analyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Analyze Requirements'}
            </button>
          )}
          {canCreateProposal && (
            <button
              type="button"
              onClick={handleGenerateProposal}
              disabled={generating || analyzing}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
              {generating ? 'Generating...' : 'Generate Proposal from RFP'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {generated && (
        <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <div className="flex items-center gap-2 font-bold">
            <FileText size={16} />
            Draft proposal created
          </div>
          <p className="mt-1 text-xs text-emerald-100/90">
            {generated.placeholders.length > 0
              ? `${generated.placeholders.length} field${generated.placeholders.length === 1 ? '' : 's'} still need your input before this proposal can be sent (unresolved placeholders are blocked by proposal validation).`
              : 'No unresolved placeholders detected — still review before sending.'}
            {generated.safetyStatus !== 'passed' && ` AI safety check: ${generated.safetyStatus}.`}
          </p>
          {generated.placeholders.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {generated.placeholders.slice(0, 12).map((p) => (
                <li
                  key={p}
                  className="rounded-md border border-emerald-400/20 bg-muted px-1.5 py-0.5 font-mono text-[11px] text-emerald-100"
                >
                  {p}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/proposals"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/30"
          >
            Review in Proposals <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-muted py-10 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto animate-spin text-indigo-300" size={18} />
        </div>
      ) : !analysis ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-muted py-10 text-center text-sm text-slate-500">
          No security requirement analysis yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Summary</h4>
              <span className="text-[11px] text-slate-500">
                {analysis.requirements.length} requirement{analysis.requirements.length === 1 ? '' : 's'} · {formatDateTime(analysis.createdAt)}
              </span>
              {analysis.fallbackUsed && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                  Structured fallback (AI unavailable)
                </span>
              )}
            </div>
            <p className="text-sm text-slate-300">{analysis.summary}</p>
          </div>

          {grouped.map(([category, reqs]) => (
            <div key={category} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300">
                <ClipboardList size={13} className="text-indigo-300" />
                {SECURITY_RFP_CATEGORY_LABELS[category] || category}
              </h4>
              <ul className="space-y-2.5">
                {reqs.map((req, idx) => (
                  <li key={`${category}-${idx}`} className="rounded-xl border border-white/5 bg-muted p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{req.requirement}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${importanceBadge[req.importance]}`}>
                        {req.importance}
                      </span>
                      <span className="text-[11px] text-slate-500">{req.confidence}% confidence</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {req.extractedValue ? (
                        <span className="font-medium text-indigo-200">{req.extractedValue}</span>
                      ) : (
                        <span className="italic text-slate-500">Named in the RFP but no value stated</span>
                      )}
                    </div>
                    {req.sourceContext && (
                      <p className="mt-1.5 border-l-2 border-white/10 pl-2 text-xs italic text-slate-500">
                        &ldquo;{req.sourceContext}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {analysis.missingInformation.length > 0 && (
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-4">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
                <HelpCircle size={13} />
                Not specified in the RFP — clarify with the client
              </h4>
              <ul className="space-y-1 text-sm text-amber-100/90">
                {analysis.missingInformation.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
