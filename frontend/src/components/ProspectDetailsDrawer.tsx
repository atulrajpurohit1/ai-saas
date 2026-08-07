'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Loader2,
  MapPin,
  MessageSquareQuote,
  Sparkles,
  Target,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  DuplicateLeadSummary,
  ImportedLeadSummary,
  ProspectCompany,
  ProspectCompanyInsight,
  getProspectCompanyInsight,
  importProspectAsLead,
  recordProspectView,
} from '@/lib/prospect-search';

type ImportPhase = 'idle' | 'importing' | 'duplicate' | 'success';

function readinessLevelClass(level: string) {
  const normalized = level.toLowerCase();
  if (normalized.includes('hot')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (normalized.includes('warm')) return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (normalized.includes('flag')) return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  return 'border-white/10 bg-white/5 text-slate-300';
}

interface ProspectDetailsDrawerProps {
  company: ProspectCompany | null;
  searchPrompt: string;
  onClose: () => void;
  canImportLeads: boolean;
  insightCache: Record<string, ProspectCompanyInsight>;
  onInsightCached: (companyId: string, insight: ProspectCompanyInsight) => void;
}

export default function ProspectDetailsDrawer({
  company,
  searchPrompt,
  onClose,
  canImportLeads,
  insightCache,
  onInsightCached,
}: ProspectDetailsDrawerProps) {
  const router = useRouter();

  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [importError, setImportError] = useState('');
  const [duplicateLead, setDuplicateLead] = useState<DuplicateLeadSummary | null>(null);
  const [importedLead, setImportedLead] = useState<ImportedLeadSummary | null>(null);

  const insight = company ? insightCache[company.id] : undefined;

  // Reset transient import UI state whenever a different company is opened.
  useEffect(() => {
    setImportPhase('idle');
    setImportError('');
    setDuplicateLead(null);
    setImportedLead(null);
  }, [company?.id]);

  // Record the view and lazily fetch the AI insight; skip the AI call entirely
  // if it's already cached for this company in the current session.
  useEffect(() => {
    if (!company) return;

    void recordProspectView(company.id, company.name).catch(() => {
      // Non-critical audit tracking call; failures should not disrupt the UI.
    });

    if (insightCache[company.id]) return;

    let cancelled = false;
    setInsightLoading(true);
    setInsightError('');

    getProspectCompanyInsight(company, searchPrompt)
      .then((result) => {
        if (cancelled) return;
        onInsightCached(company.id, result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setInsightError(
          getApiErrorMessage(err, 'Could not generate an AI insight for this company.'),
        );
      })
      .finally(() => {
        if (!cancelled) setInsightLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    if (!company) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [company, onClose]);

  if (!company) return null;

  const hasProfileData = Boolean(
    company.industry ||
      company.city ||
      company.state ||
      company.employeeCount !== undefined ||
      company.revenueRange ||
      company.website ||
      company.description,
  );

  const handleImport = async (force: boolean) => {
    setImportPhase('importing');
    setImportError('');

    try {
      const result = await importProspectAsLead(company, force);
      if (result.duplicate) {
        setDuplicateLead(result.existingLead);
        setImportPhase('duplicate');
      } else {
        setImportedLead(result.lead);
        setImportPhase('success');
      }
    } catch (err) {
      setImportError(getApiErrorMessage(err, 'Failed to import this company as a lead.'));
      setImportPhase('idle');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${company.name} details`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div className="relative flex h-dvh w-full flex-col overflow-y-auto border-l border-white/10 bg-[#0f172a] shadow-2xl sm:w-[480px]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Building2 size={14} aria-hidden="true" />
              Company Details
            </div>
            <h2 className="mt-1 truncate text-xl font-bold text-white">{company.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close company details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          {hasProfileData && (
            <section>
              {company.industry && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                    {company.industry}
                  </span>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                {(company.city || company.state) && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin size={14} className="shrink-0" aria-hidden="true" />
                    <span>{[company.city, company.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {company.employeeCount !== undefined && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users size={14} className="shrink-0" aria-hidden="true" />
                    <span>{company.employeeCount.toLocaleString()} Employees</span>
                  </div>
                )}
                {company.revenueRange && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <DollarSign size={14} className="shrink-0" aria-hidden="true" />
                    <span>{company.revenueRange}</span>
                  </div>
                )}
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-300 transition hover:text-indigo-200"
                  >
                    <Globe size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">Website</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </dl>

              {company.description && (
                <p className="mt-4 text-sm leading-6 text-slate-400">{company.description}</p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Sparkles size={16} className="text-indigo-300" aria-hidden="true" />
                AI Playbook
              </h3>
              {insight?.readinessLevel && (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${readinessLevelClass(insight.readinessLevel)}`}
                >
                  {insight.readinessLevel}
                </span>
              )}
            </div>

            {insightLoading && (
              <div className="flex items-center gap-3 py-4 text-sm text-slate-400">
                <Loader2 className="animate-spin text-indigo-300" size={18} aria-hidden="true" />
                Generating insight...
              </div>
            )}

            {!insightLoading && insightError && (
              <div
                role="alert"
                className="flex items-center gap-2 text-sm font-semibold text-rose-300"
              >
                <AlertTriangle size={16} aria-hidden="true" />
                {insightError}
              </div>
            )}

            {!insightLoading && !insightError && insight && (
              <div className="space-y-5 text-sm leading-6 text-slate-300">
                {(insight.businessSummary || insight.businessObjective) && (
                  <div className="space-y-2">
                    {insight.businessSummary && <p>{insight.businessSummary}</p>}
                    {insight.businessObjective && <p>{insight.businessObjective}</p>}
                  </div>
                )}

                {insight.valueProps.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <Target size={13} aria-hidden="true" />
                      Value Props
                    </h4>
                    <ul className="list-disc space-y-1 pl-5">
                      {insight.valueProps.map((prop, index) => (
                        <li key={index}>{prop}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {insight.salesAngles.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <Target size={13} aria-hidden="true" />
                      Sales Angles
                    </h4>
                    <ul className="list-disc space-y-1 pl-5">
                      {insight.salesAngles.map((angle, index) => (
                        <li key={index}>{angle}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {insight.keyPersonas.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <Users size={13} aria-hidden="true" />
                      Key Personas
                    </h4>
                    <div className="space-y-3">
                      {insight.keyPersonas.map((persona, index) => (
                        <div key={index} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                          <p className="font-bold text-white">
                            {persona.name}
                            {persona.title && (
                              <span className="ml-1 font-normal text-slate-400">— {persona.title}</span>
                            )}
                          </p>
                          {persona.description && (
                            <p className="mt-1 text-slate-400">{persona.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insight.potentialObjections.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <HelpCircle size={13} aria-hidden="true" />
                      Potential Objections
                    </h4>
                    <div className="space-y-3">
                      {insight.potentialObjections.map((item, index) => (
                        <div key={index} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                          <p className="font-bold text-white">&ldquo;{item.objection}&rdquo;</p>
                          <p className="mt-1 text-slate-400">{item.response}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insight.meetingNoteExample && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <MessageSquareQuote size={13} aria-hidden="true" />
                      Meeting Note Example
                    </h4>
                    <blockquote className="border-l-2 border-indigo-400/40 pl-3 italic text-slate-400">
                      {insight.meetingNoteExample}
                    </blockquote>
                  </div>
                )}

                {insight.contactOverview && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <Info size={13} aria-hidden="true" />
                      Contact Overview
                    </h4>
                    <p className="text-slate-400">{insight.contactOverview}</p>
                  </div>
                )}

                {insight.documentUrl && /^https?:\/\//.test(insight.documentUrl) && (
                  <a
                    href={insight.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-300 transition hover:text-indigo-200"
                  >
                    <FileText size={14} className="shrink-0" aria-hidden="true" />
                    View full playbook
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </section>

          {importPhase === 'duplicate' && duplicateLead && (
            <section
              role="alertdialog"
              aria-label="Lead already exists"
              className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"
            >
              <p className="mb-4 text-sm font-bold text-amber-200">Lead already exists.</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/leads/${duplicateLead.id}`)}
                  className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400"
                >
                  Open Existing Lead
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport(true)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Import Anyway
                </button>
                <button
                  type="button"
                  onClick={() => setImportPhase('idle')}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {importPhase === 'success' && importedLead && (
            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="mb-4 flex items-center gap-2 text-sm font-bold text-emerald-200">
                <CheckCircle2 size={18} aria-hidden="true" />
                Lead imported successfully
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push(`/leads/${importedLead.id}`)}
                  className="flex-1 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400"
                >
                  Open Lead
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Continue Searching
                </button>
              </div>
            </section>
          )}

          {importError && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300"
            >
              <AlertTriangle size={16} aria-hidden="true" />
              {importError}
            </div>
          )}
        </div>

        {(importPhase === 'idle' || importPhase === 'importing') && (
          <div className="border-t border-white/10 p-5">
            <button
              type="button"
              onClick={() => void handleImport(false)}
              disabled={!canImportLeads || importPhase === 'importing'}
              title={canImportLeads ? undefined : 'You do not have permission to import leads'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importPhase === 'importing' ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                <UserPlus size={18} aria-hidden="true" />
              )}
              {importPhase === 'importing' ? 'Importing...' : 'Import Lead'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
