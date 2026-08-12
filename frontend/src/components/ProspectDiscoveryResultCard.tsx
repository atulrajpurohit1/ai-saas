'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Quote,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  DiscoveredProspect,
  DuplicateLeadSummary,
  ImportedLeadSummary,
  ProspectCompany,
  importProspectAsLead,
} from '@/lib/prospect-search';

type ImportPhase = 'idle' | 'importing' | 'duplicate' | 'success';

function qualificationClass(score: number) {
  if (score >= 0.85) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (score >= 0.6) return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-white/10 bg-white/5 text-slate-300';
}

interface ProspectDiscoveryResultCardProps {
  prospect: DiscoveredProspect;
  canImportLeads: boolean;
  onOpenDeepResearch: (company: ProspectCompany) => void;
}

export default function ProspectDiscoveryResultCard({
  prospect,
  canImportLeads,
  onOpenDeepResearch,
}: ProspectDiscoveryResultCardProps) {
  const router = useRouter();
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [importError, setImportError] = useState('');
  const [duplicateLead, setDuplicateLead] = useState<DuplicateLeadSummary | null>(null);
  const [importedLead, setImportedLead] = useState<ImportedLeadSummary | null>(null);

  const companyName = prospect.companyName ?? 'Unknown company';

  const asProspectCompany = (): ProspectCompany => {
    // companyLocation is a single free-text string from BlackPearl (e.g.
    // "Kansas City, MO" or just "Mumbai") - splitting it on commas is a
    // mechanical parse of real data, not a guess, so partial location parts
    // are left undefined rather than invented.
    const [city, state, country] = (prospect.companyLocation ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      id: prospect.id,
      name: companyName,
      industry: prospect.companyIndustry,
      website: prospect.companyDomain,
      city,
      state,
      country,
      employeeCount: prospect.companyHeadcount,
      description: prospect.companyDescription,
      contactName: prospect.contact.fullName,
      contactTitle: prospect.contact.jobTitle,
      contactEmail: prospect.contact.email,
      contactProfileUrl: prospect.contact.profileUrl,
      qualificationReason: prospect.qualificationReason,
      signals: prospect.signals.map((signal) => signal.snippet || signal.label),
    };
  };

  const handleImport = async (force: boolean) => {
    setImportPhase('importing');
    setImportError('');

    try {
      const result = await importProspectAsLead(asProspectCompany(), force);
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="shrink-0 text-indigo-300" aria-hidden="true" />
            <h3 className="truncate text-base font-bold text-white">{companyName}</h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            {prospect.companyIndustry && <span>{prospect.companyIndustry}</span>}
            {prospect.companyLocation && (
              <span className="flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" />
                {prospect.companyLocation}
              </span>
            )}
            {typeof prospect.companyHeadcount === 'number' && (
              <span className="flex items-center gap-1">
                <Users size={12} aria-hidden="true" />
                {prospect.companyHeadcount.toLocaleString()} employees
              </span>
            )}
            {prospect.companyDomain && (
              <a
                href={
                  prospect.companyDomain.startsWith('http')
                    ? prospect.companyDomain
                    : `https://${prospect.companyDomain}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200"
              >
                {prospect.companyDomain}
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${qualificationClass(prospect.qualificationScore)}`}
          title="How well this prospect matches your search"
        >
          {Math.round(prospect.qualificationScore * 100)}% match
        </span>
      </div>

      {(prospect.contact.fullName || prospect.contact.jobTitle) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
          {prospect.contact.fullName && (
            <span className="font-semibold text-white">{prospect.contact.fullName}</span>
          )}
          {prospect.contact.jobTitle && (
            <span className="flex items-center gap-1 text-slate-400">
              <Briefcase size={13} aria-hidden="true" />
              {prospect.contact.jobTitle}
            </span>
          )}
          {prospect.contact.email && (
            <a
              href={`mailto:${prospect.contact.email}`}
              className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200"
            >
              <Mail size={13} aria-hidden="true" />
              {prospect.contact.email}
            </a>
          )}
          {prospect.contact.profileUrl && (
            <a
              href={prospect.contact.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-slate-400 hover:text-white"
            >
              Profile
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {prospect.qualificationReason && (
        <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-300">
          <Sparkles size={14} className="mt-1 shrink-0 text-indigo-300" aria-hidden="true" />
          {prospect.qualificationReason}
        </p>
      )}

      {prospect.signals.length > 0 && (
        <div className="mt-3 space-y-2">
          {prospect.signals.map((signal, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-400"
            >
              <Quote size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{signal.snippet ?? signal.label}</span>
            </div>
          ))}
        </div>
      )}

      {importPhase === 'duplicate' && duplicateLead && (
        <div
          role="alertdialog"
          aria-label="Lead already exists"
          className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3"
        >
          <p className="mb-2 text-xs font-bold text-amber-200">Lead already exists.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/leads/${duplicateLead.id}`)}
              className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400"
            >
              Open Existing Lead
            </button>
            <button
              type="button"
              onClick={() => void handleImport(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
            >
              Import Anyway
            </button>
            <button
              type="button"
              onClick={() => setImportPhase('idle')}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {importPhase === 'success' && importedLead && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-200">
            <CheckCircle2 size={15} aria-hidden="true" />
            Lead imported
          </p>
          <button
            type="button"
            onClick={() => router.push(`/leads/${importedLead.id}`)}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400"
          >
            Open Lead
          </button>
        </div>
      )}

      {importError && (
        <div
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300"
        >
          <AlertTriangle size={14} aria-hidden="true" />
          {importError}
        </div>
      )}

      {(importPhase === 'idle' || importPhase === 'importing') && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleImport(false)}
            disabled={!canImportLeads || importPhase === 'importing'}
            title={canImportLeads ? undefined : 'You do not have permission to import leads'}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importPhase === 'importing' ? (
              <Loader2 className="animate-spin" size={14} aria-hidden="true" />
            ) : (
              <UserPlus size={14} aria-hidden="true" />
            )}
            {importPhase === 'importing' ? 'Importing...' : 'Import as Lead'}
          </button>
          <button
            type="button"
            onClick={() => onOpenDeepResearch(asProspectCompany())}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10"
          >
            <Sparkles size={14} aria-hidden="true" />
            Generate Full AI Playbook
          </button>
        </div>
      )}
    </div>
  );
}
