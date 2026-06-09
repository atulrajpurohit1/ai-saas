'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BrainCircuit,
  ClipboardList,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Target,
} from 'lucide-react';
import api from '@/lib/api';

type EntityType = 'lead' | 'deal';

interface DiscoverySession {
  id: string;
  propertyType: string | null;
  buyerRole: string | null;
  currentProvider: string | null;
  guardCount: number | null;
  serviceHours: string | null;
  painPoints: string[];
  riskConcerns: string[];
  decisionTimeline: string | null;
  budgetSensitivity: string | null;
  objections: string[];
  notes: string | null;
  createdAt: string;
}

interface SalesAssessment {
  id: string;
  leadScore: number | null;
  priorityTier: string | null;
  closeReadinessScore: number | null;
  discoveryQualityScore: number | null;
  riskProfile: string | null;
  proposalAngle: string | null;
  recommendedNextAction: string | null;
  missingQuestions: string[];
  objectionRisks: string[];
  summary: string | null;
  createdAt: string;
}

interface DiscoveryGuide {
  questions: string[];
  talkingPoints: string[];
  followUpAngles: string[];
  qualificationChecklist: string[];
}

interface DiscoveryForm {
  propertyType: string;
  buyerRole: string;
  currentProvider: string;
  guardCount: string;
  serviceHours: string;
  painPoints: string;
  riskConcerns: string;
  decisionTimeline: string;
  budgetSensitivity: string;
  objections: string;
  notes: string;
}

interface SalesAcceleratorPanelProps {
  entityType: EntityType;
  entityId: string;
}

const emptyForm: DiscoveryForm = {
  propertyType: '',
  buyerRole: '',
  currentProvider: '',
  guardCount: '',
  serviceHours: '',
  painPoints: '',
  riskConcerns: '',
  decisionTimeline: '',
  budgetSensitivity: '',
  objections: '',
  notes: '',
};

const listToText = (items?: string[] | null) => (items || []).join('\n');

const textToList = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const formFromDiscovery = (discovery?: DiscoverySession | null): DiscoveryForm => {
  if (!discovery) return emptyForm;

  return {
    propertyType: discovery.propertyType || '',
    buyerRole: discovery.buyerRole || '',
    currentProvider: discovery.currentProvider || '',
    guardCount: discovery.guardCount ? String(discovery.guardCount) : '',
    serviceHours: discovery.serviceHours || '',
    painPoints: listToText(discovery.painPoints),
    riskConcerns: listToText(discovery.riskConcerns),
    decisionTimeline: discovery.decisionTimeline || '',
    budgetSensitivity: discovery.budgetSensitivity || '',
    objections: listToText(discovery.objections),
    notes: discovery.notes || '',
  };
};

const scoreColor = (score?: number | null) => {
  if ((score || 0) >= 75) return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10';
  if ((score || 0) >= 50) return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
};

const fieldClass =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-600';

export default function SalesAcceleratorPanel({
  entityType,
  entityId,
}: SalesAcceleratorPanelProps) {
  const [form, setForm] = useState<DiscoveryForm>(emptyForm);
  const [discovery, setDiscovery] = useState<DiscoverySession | null>(null);
  const [assessment, setAssessment] = useState<SalesAssessment | null>(null);
  const [guide, setGuide] = useState<DiscoveryGuide | null>(null);
  const [generatedProposalId, setGeneratedProposalId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const basePath = useMemo(
    () => `sales-accelerator/${entityType === 'lead' ? 'leads' : 'deals'}/${entityId}`,
    [entityId, entityType],
  );

  useEffect(() => {
    const loadWorkspace = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get(basePath);
        setDiscovery(response.data.discovery || null);
        setAssessment(response.data.assessment || null);
        setForm(formFromDiscovery(response.data.discovery));
      } catch (err) {
        console.error('Failed to load sales accelerator workspace', err);
        setError('Could not load sales accelerator details.');
      } finally {
        setLoading(false);
      }
    };

    if (entityId) loadWorkspace();
  }, [basePath, entityId]);

  const updateField = (key: keyof DiscoveryForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const payload = () => ({
    propertyType: form.propertyType,
    buyerRole: form.buyerRole,
    currentProvider: form.currentProvider,
    guardCount: form.guardCount ? Number(form.guardCount) : undefined,
    serviceHours: form.serviceHours,
    painPoints: textToList(form.painPoints),
    riskConcerns: textToList(form.riskConcerns),
    decisionTimeline: form.decisionTimeline,
    budgetSensitivity: form.budgetSensitivity,
    objections: textToList(form.objections),
    notes: form.notes,
  });

  const saveDiscovery = async () => {
    setBusy('save');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/discovery`, payload());
      setDiscovery(response.data);
      setMessage('Discovery saved.');
    } catch (err) {
      console.error('Failed to save discovery', err);
      setError('Could not save discovery details.');
    } finally {
      setBusy('');
    }
  };

  const generateGuide = async () => {
    setBusy('guide');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/discovery-guide`);
      setGuide(response.data.guide);
      setMessage(response.data.fallbackUsed ? 'Guide generated with fallback logic.' : 'Guide generated.');
    } catch (err) {
      console.error('Failed to generate discovery guide', err);
      setError('Could not generate discovery guide.');
    } finally {
      setBusy('');
    }
  };

  const score = async () => {
    setBusy('score');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/score`);
      setAssessment(response.data.assessment);
      setMessage(response.data.fallbackUsed ? 'Assessment generated with fallback logic.' : 'Assessment generated.');
    } catch (err) {
      console.error('Failed to generate sales assessment', err);
      setError('Could not generate sales assessment.');
    } finally {
      setBusy('');
    }
  };

  const generateProposal = async () => {
    setBusy('proposal');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/proposal-from-discovery`);
      setGeneratedProposalId(response.data.proposal.id);
      setMessage(response.data.fallbackUsed ? 'Proposal drafted with fallback logic.' : 'Proposal drafted.');
    } catch (err) {
      console.error('Failed to generate proposal from discovery', err);
      setError('Capture discovery details before drafting a proposal.');
    } finally {
      setBusy('');
    }
  };

  const renderList = (items: string[]) =>
    items.length === 0 ? (
      <p className="text-sm text-slate-500">No items yet.</p>
    ) : (
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
            {item}
          </li>
        ))}
      </ul>
    );

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-300">
            <BrainCircuit size={14} />
            Sales Accelerator
          </div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">Discovery and Deal Intelligence</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveDiscovery}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'save' ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Save
          </button>
          <button
            type="button"
            onClick={generateGuide}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-3 py-2 text-xs font-bold text-indigo-200 transition hover:bg-indigo-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'guide' ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
            Guide
          </button>
          <button
            type="button"
            onClick={score}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'score' ? <Loader2 className="animate-spin" size={15} /> : <Target size={15} />}
            Score
          </button>
          {entityType === 'deal' && (
            <button
              type="button"
              onClick={generateProposal}
              disabled={!!busy || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-400/20 bg-purple-400/10 px-3 py-2 text-xs font-bold text-purple-200 transition hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'proposal' ? <Loader2 className="animate-spin" size={15} /> : <FileText size={15} />}
              Proposal
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 py-12 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-cyan-300" size={24} />
          Loading sales intelligence...
        </div>
      ) : (
        <div className="space-y-6">
          {(error || message || generatedProposalId) && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                error
                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {error || message}
              {generatedProposalId && (
                <Link href="/proposals" className="ml-2 font-bold text-white underline-offset-4 hover:underline">
                  Open proposals
                </Link>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-4">
            {[
              ['Lead Score', assessment?.leadScore],
              ['Discovery', assessment?.discoveryQualityScore],
              ['Readiness', assessment?.closeReadinessScore],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</div>
                <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-lg font-extrabold ${scoreColor(value as number | null)}`}>
                  {typeof value === 'number' ? value : '--'}
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Priority</div>
              <div className="mt-3 text-lg font-extrabold uppercase text-white">{assessment?.priorityTier || '--'}</div>
            </div>
          </div>

          {assessment && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Risk Profile</div>
                <p className="text-sm leading-6 text-slate-300">{assessment.riskProfile || 'No risk profile generated.'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Proposal Angle</div>
                <p className="text-sm leading-6 text-slate-300">{assessment.proposalAngle || 'No proposal angle generated.'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Next Action</div>
                <p className="text-sm leading-6 text-slate-300">{assessment.recommendedNextAction || 'No next action generated.'}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input className={fieldClass} placeholder="Property type" value={form.propertyType} onChange={(e) => updateField('propertyType', e.target.value)} />
                <input className={fieldClass} placeholder="Buyer role" value={form.buyerRole} onChange={(e) => updateField('buyerRole', e.target.value)} />
                <input className={fieldClass} placeholder="Current provider" value={form.currentProvider} onChange={(e) => updateField('currentProvider', e.target.value)} />
                <input className={fieldClass} type="number" min="1" placeholder="Guard count" value={form.guardCount} onChange={(e) => updateField('guardCount', e.target.value)} />
                <input className={fieldClass} placeholder="Service hours" value={form.serviceHours} onChange={(e) => updateField('serviceHours', e.target.value)} />
                <input className={fieldClass} placeholder="Decision timeline" value={form.decisionTimeline} onChange={(e) => updateField('decisionTimeline', e.target.value)} />
                <input className={fieldClass} placeholder="Budget sensitivity" value={form.budgetSensitivity} onChange={(e) => updateField('budgetSensitivity', e.target.value)} />
              </div>

              <textarea className={`${fieldClass} min-h-24 resize-y`} placeholder="Pain points" value={form.painPoints} onChange={(e) => updateField('painPoints', e.target.value)} />
              <textarea className={`${fieldClass} min-h-24 resize-y`} placeholder="Risk concerns" value={form.riskConcerns} onChange={(e) => updateField('riskConcerns', e.target.value)} />
              <textarea className={`${fieldClass} min-h-24 resize-y`} placeholder="Objections" value={form.objections} onChange={(e) => updateField('objections', e.target.value)} />
              <textarea className={`${fieldClass} min-h-28 resize-y`} placeholder="Discovery notes" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <ClipboardList size={14} />
                  Missing Questions
                </div>
                {renderList(assessment?.missingQuestions || [])}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <Sparkles size={14} />
                  Discovery Guide
                </div>
                {guide ? (
                  <div className="space-y-4">
                    <div>{renderList(guide.questions)}</div>
                    <div>{renderList(guide.talkingPoints)}</div>
                    <div>{renderList(guide.followUpAngles)}</div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No guide generated yet.</p>
                )}
              </div>
            </div>
          </div>

          {discovery && (
            <div className="text-xs text-slate-500">
              Last discovery saved {new Date(discovery.createdAt).toLocaleString()}.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
