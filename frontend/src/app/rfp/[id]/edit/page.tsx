'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import RfpEditor from '@/components/RfpEditor';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  generateRfp,
  getRfp,
  markdownToHtml,
  RfpFormInput,
  RfpStatus,
  SECURITY_TYPE_OPTIONS,
  updateRfp,
} from '@/lib/rfp';
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

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

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

export default function EditRfpPage() {
  const params = useParams<{ id: string }>();
  const rfpId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  const [form, setForm] = useState<RfpFormState | null>(null);
  const [status, setStatus] = useState<RfpStatus>('DRAFT');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!rfpId) return;
    const fetchRfp = async () => {
      setLoading(true);
      try {
        const rfp = await getRfp(rfpId);
        setForm({
          title: rfp.title,
          clientName: rfp.clientName,
          companyName: rfp.companyName || '',
          industry: rfp.industry || '',
          projectName: rfp.projectName || '',
          dueDate: toDateInputValue(rfp.dueDate),
          startDate: toDateInputValue(rfp.startDate),
          endDate: toDateInputValue(rfp.endDate),
          estimatedBudget: rfp.estimatedBudget !== null ? String(rfp.estimatedBudget) : '',
          securityTypes: rfp.securityTypes,
          numberOfLocations: rfp.numberOfLocations !== null ? String(rfp.numberOfLocations) : '',
          address: rfp.address || '',
          operatingHours: rfp.operatingHours || '',
          guardsRequired: rfp.guardsRequired !== null ? String(rfp.guardsRequired) : '',
          additionalRequirements: rfp.additionalRequirements || '',
        });
        setGeneratedHtml(rfp.generatedContent || '');
        setStatus(rfp.status);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this RFP.'));
      } finally {
        setLoading(false);
      }
    };
    fetchRfp();
  }, [rfpId]);

  const update = <K extends keyof RfpFormState>(key: K, value: RfpFormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const toggleSecurityType = (type: string) => {
    setForm((current) =>
      current
        ? {
            ...current,
            securityTypes: current.securityTypes.includes(type)
              ? current.securityTypes.filter((item) => item !== type)
              : [...current.securityTypes, type],
          }
        : current,
    );
  };

  const validateBasics = () => {
    if (!form || !form.title.trim() || !form.clientName.trim()) {
      setError('RFP Title and Client Name are required.');
      return false;
    }
    setError('');
    return true;
  };

  const handleRegenerate = async () => {
    if (!form || !validateBasics()) return;
    setGenerating(true);
    setError('');
    try {
      const { content } = await generateRfp(toFormInput(form));
      setGeneratedHtml(markdownToHtml(content));
      setStatus('GENERATED');
      setRevision((current) => current + 1);
    } catch (err) {
      setError(getApiErrorMessage(err, 'AI generation failed. Check your Gemini API key configuration.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form || !rfpId || !validateBasics()) return;
    setSaving(true);
    setError('');
    try {
      await updateRfp(rfpId, {
        ...toFormInput(form),
        generatedContent: generatedHtml || undefined,
        status,
      });
      router.push(`/rfp/${rfpId}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this RFP.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="rfp.update">
      <div className="mb-6">
        <Link href={`/rfp/${rfpId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to RFP
        </Link>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold sm:text-3xl">Edit RFP</h2>
        <p className="mt-2 text-muted-foreground">Update the details, regenerate with AI if needed, then save.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {loading || !form ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading RFP...
        </div>
      ) : (
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
                <input className={inputClass} value={form.operatingHours} onChange={(e) => update('operatingHours', e.target.value)} />
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
              value={form.additionalRequirements}
              onChange={(e) => update('additionalRequirements', e.target.value)}
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold text-white">Generated Document</h3>
              <p className="text-xs text-muted-foreground">Edit directly, or regenerate from the fields above.</p>
            </div>
            <RfpEditor content={generatedHtml} onChange={setGeneratedHtml} revision={revision} />
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={generating || saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {generating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              Regenerate with AI
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || generating}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
