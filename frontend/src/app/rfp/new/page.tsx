'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import RfpEditor from '@/components/RfpEditor';
import { getApiErrorMessage } from '@/lib/api-error';
import { createRfp, generateRfp, markdownToHtml, RfpFormInput, SECURITY_TYPE_OPTIONS } from '@/lib/rfp';
import { AlertTriangle, ArrowLeft, Loader2, Save, Sparkles } from 'lucide-react';

const inputClass =
  'min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50';
const labelClass = 'text-sm font-semibold text-slate-300';

interface RfpFormState {
  title: string;
  clientName: string;
  companyName: string;
  industry: string;
  projectName: string;
  dueDate: string;
  startDate: string;
  endDate: string;
  estimatedBudget: string;
  securityTypes: string[];
  numberOfLocations: string;
  address: string;
  operatingHours: string;
  guardsRequired: string;
  additionalRequirements: string;
}

const emptyForm: RfpFormState = {
  title: '',
  clientName: '',
  companyName: '',
  industry: '',
  projectName: '',
  dueDate: '',
  startDate: '',
  endDate: '',
  estimatedBudget: '',
  securityTypes: [],
  numberOfLocations: '',
  address: '',
  operatingHours: '',
  guardsRequired: '',
  additionalRequirements: '',
};

function toFormInput(form: RfpFormState): RfpFormInput {
  return {
    title: form.title.trim(),
    clientName: form.clientName.trim(),
    companyName: form.companyName.trim() || undefined,
    industry: form.industry.trim() || undefined,
    projectName: form.projectName.trim() || undefined,
    dueDate: form.dueDate || undefined,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : undefined,
    securityTypes: form.securityTypes,
    numberOfLocations: form.numberOfLocations ? Number(form.numberOfLocations) : undefined,
    address: form.address.trim() || undefined,
    operatingHours: form.operatingHours.trim() || undefined,
    guardsRequired: form.guardsRequired ? Number(form.guardsRequired) : undefined,
    additionalRequirements: form.additionalRequirements.trim() || undefined,
  };
}

export default function NewRfpPage() {
  const router = useRouter();
  const [form, setForm] = useState<RfpFormState>(emptyForm);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [revision, setRevision] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = <K extends keyof RfpFormState>(key: K, value: RfpFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleSecurityType = (type: string) => {
    setForm((current) => ({
      ...current,
      securityTypes: current.securityTypes.includes(type)
        ? current.securityTypes.filter((item) => item !== type)
        : [...current.securityTypes, type],
    }));
  };

  const validateBasics = () => {
    if (!form.title.trim() || !form.clientName.trim()) {
      setError('RFP Title and Client Name are required.');
      return false;
    }
    setError('');
    return true;
  };

  const handleGenerate = async () => {
    if (!validateBasics()) return;
    setGenerating(true);
    setError('');
    try {
      const { content } = await generateRfp(toFormInput(form));
      setGeneratedHtml(markdownToHtml(content));
      setHasGenerated(true);
      setRevision((current) => current + 1);
    } catch (err) {
      setError(getApiErrorMessage(err, 'AI generation failed. Check your Gemini API key configuration.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status: 'DRAFT' | 'GENERATED') => {
    if (!validateBasics()) return;
    setSaving(true);
    setError('');
    try {
      const created = await createRfp({
        ...toFormInput(form),
        generatedContent: generatedHtml || undefined,
        status,
      });
      router.push(`/rfp/${created.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this RFP.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="rfp.create">
      <div className="mb-6">
        <Link href="/rfp" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to RFPs
        </Link>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold sm:text-3xl">Create RFP</h2>
        <p className="mt-2 text-muted-foreground">Fill in the details below, then generate a professional RFP draft with AI.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Basic Information</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2 xl:col-span-2">
              <label className={labelClass}>RFP Title *</label>
              <input className={inputClass} value={form.title} onChange={(e) => update('title', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Client Name *</label>
              <input className={inputClass} value={form.clientName} onChange={(e) => update('clientName', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Company Name</label>
              <input className={inputClass} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Industry</label>
              <input className={inputClass} value={form.industry} onChange={(e) => update('industry', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Project Name</label>
              <input className={inputClass} value={form.projectName} onChange={(e) => update('projectName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Due Date</label>
              <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Estimated Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.estimatedBudget}
                onChange={(e) => update('estimatedBudget', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Start Date</label>
              <input type="date" className={inputClass} value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>End Date</label>
              <input type="date" className={inputClass} value={form.endDate} onChange={(e) => update('endDate', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Security Requirements</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SECURITY_TYPE_OPTIONS.map((type) => {
              const active = form.securityTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleSecurityType(type)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-indigo-400/40 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Site Information</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className={labelClass}>Number of Locations</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.numberOfLocations}
                onChange={(e) => update('numberOfLocations', e.target.value)}
              />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <label className={labelClass}>Address</label>
              <input className={inputClass} value={form.address} onChange={(e) => update('address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Operating Hours</label>
              <input
                placeholder="e.g. 24/7 or Mon-Fri 8am-6pm"
                className={inputClass}
                value={form.operatingHours}
                onChange={(e) => update('operatingHours', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Number of Guards</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.guardsRequired}
                onChange={(e) => update('guardsRequired', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Additional Requirements</h3>
          <textarea
            rows={5}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="Any other requirements, context, or special instructions for this RFP..."
            value={form.additionalRequirements}
            onChange={(e) => update('additionalRequirements', e.target.value)}
          />
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => handleSave('DRAFT')}
            disabled={saving || generating}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save as Draft
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 font-bold text-white shadow-lg transition hover:from-indigo-400 hover:to-purple-400 disabled:opacity-50"
          >
            {generating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {generating ? 'Generating...' : '✨ Generate RFP'}
          </button>
        </div>

        {hasGenerated && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold text-white">Generated RFP Document</h3>
              <p className="text-xs text-muted-foreground">Review and edit the AI-generated draft below before saving.</p>
            </div>
            <RfpEditor content={generatedHtml} onChange={setGeneratedHtml} revision={revision} />
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/5 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {generating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => handleSave('GENERATED')}
                disabled={saving || generating}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save RFP
              </button>
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
