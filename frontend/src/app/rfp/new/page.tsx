'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import AiPlanNotice from '@/components/AiPlanNotice';
import RfpEditor from '@/components/RfpEditor';
import RfpLogoUploadField from '@/components/RfpLogoUploadField';
import DateField from '@/components/DateField';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  createRfp,
  generateRfp,
  markdownToHtml,
  PRICING_COMPONENT_OPTIONS,
  PRICING_MODEL_OPTIONS,
  RfpFormInput,
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
  pricingModel: string;
  requiredPricingItems: string[];
  paymentTerms: string;
  pricingValidity: string;
  pricingNotes: string;
  additionalRequirements: string;
  issuerLogoUrl: string;
  recipientLogoUrl: string;
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
  pricingModel: '',
  requiredPricingItems: [],
  paymentTerms: '',
  pricingValidity: '',
  pricingNotes: '',
  additionalRequirements: '',
  issuerLogoUrl: '',
  recipientLogoUrl: '',
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
    pricingModel: form.pricingModel || undefined,
    requiredPricingItems: form.requiredPricingItems,
    paymentTerms: form.paymentTerms.trim() || undefined,
    pricingValidity: form.pricingValidity.trim() || undefined,
    pricingNotes: form.pricingNotes.trim() || undefined,
    additionalRequirements: form.additionalRequirements.trim() || undefined,
    issuerLogoUrl: form.issuerLogoUrl || undefined,
    recipientLogoUrl: form.recipientLogoUrl || undefined,
  };
}

export default function NewRfpPage() {
  const router = useRouter();
  const [form, setForm] = useState<RfpFormState>(emptyForm);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [savedRfpId, setSavedRfpId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RfpFormState, string>>>({});
  const generatedSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!hasGenerated) return;
    const timer = window.setTimeout(() => {
      generatedSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hasGenerated, revision]);

  const update = <K extends keyof RfpFormState>(key: K, value: RfpFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Clear a field's error as soon as the user edits it.
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const toggleSecurityType = (type: string) => {
    setForm((current) => ({
      ...current,
      securityTypes: current.securityTypes.includes(type)
        ? current.securityTypes.filter((item) => item !== type)
        : [...current.securityTypes, type],
    }));
  };

  const togglePricingItem = (item: string) => {
    setForm((current) => ({
      ...current,
      requiredPricingItems: current.requiredPricingItems.includes(item)
        ? current.requiredPricingItems.filter((entry) => entry !== item)
        : [...current.requiredPricingItems, item],
    }));
  };

  // Full client-side validation across every field that carries a constraint.
  // Required fields, numeric fields (non-negative; counts must be whole
  // numbers), and date ordering (end must not precede start) are all checked,
  // with a message pinned to each offending field.
  const validate = () => {
    const errors: Partial<Record<keyof RfpFormState, string>> = {};

    if (!form.title.trim()) errors.title = 'RFP Title is required.';
    if (!form.clientName.trim()) errors.clientName = 'Client Name is required.';

    const budget = form.estimatedBudget.trim();
    if (budget) {
      const n = Number(budget);
      if (!Number.isFinite(n) || n < 0) {
        errors.estimatedBudget = 'Enter a valid amount (0 or more).';
      }
    }

    const wholeNonNegative = (raw: string) => {
      const n = Number(raw);
      return Number.isInteger(n) && n >= 0;
    };
    if (form.numberOfLocations.trim() && !wholeNonNegative(form.numberOfLocations)) {
      errors.numberOfLocations = 'Enter a whole number (0 or more).';
    }
    if (form.guardsRequired.trim() && !wholeNonNegative(form.guardsRequired)) {
      errors.guardsRequired = 'Enter a whole number (0 or more).';
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errors.endDate = 'End date cannot be before the start date.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields before continuing.');
      return false;
    }
    setError('');
    return true;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setGenerating(true);
    setError('');
    let draftWasSaved = false;
    try {
      const formInput = toFormInput(form);

      // Persist before asking AI to do any work. A long-running generation can
      // outlive a browser refresh or an expired session, and previously that
      // meant the complete RFP was lost because no record existed yet.
      let rfpId = savedRfpId;
      if (rfpId) {
        await updateRfp(rfpId, { ...formInput, status: 'DRAFT' });
      } else {
        const draft = await createRfp({ ...formInput, status: 'DRAFT' });
        rfpId = draft.id;
        setSavedRfpId(draft.id);
      }
      draftWasSaved = true;

      const { content } = await generateRfp({
        ...formInput,
        issuerLogoUrl: undefined,
        recipientLogoUrl: undefined,
      });
      const html = markdownToHtml(content);

      // Save the generated document immediately as well. From this point the
      // draft is recoverable from RFP Management even if the browser closes
      // before the user makes further edits.
      await updateRfp(rfpId, {
        ...formInput,
        generatedContent: html,
        status: 'GENERATED',
      });
      setGeneratedHtml(html);
      setHasGenerated(true);
      setRevision((current) => current + 1);
    } catch (err) {
      setError(getApiErrorMessage(
        err,
        draftWasSaved
          ? 'Your RFP draft is saved, but the generated document could not be completed or saved. Reopen it from RFP Management and try again.'
          : 'Could not save the RFP draft. Please try again.',
      ));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status: 'DRAFT' | 'GENERATED') => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const input = {
        ...toFormInput(form),
        generatedContent: generatedHtml || undefined,
        status,
      };
      const saved = savedRfpId
        ? await updateRfp(savedRfpId, input)
        : await createRfp(input);
      setSavedRfpId(saved.id);
      router.push(`/rfp/${saved.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this RFP.'));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (key: keyof RfpFormState) =>
    `${inputClass} ${fieldErrors[key] ? '!border-error focus:ring-error/40' : ''}`;
  const renderError = (key: keyof RfpFormState) =>
    fieldErrors[key] ? (
      <p className="text-xs font-semibold text-error">{fieldErrors[key]}</p>
    ) : null;

  return (
    <DashboardLayout requiredModule="LEAD_GEN" requiredPermissions="rfp.create">
      <AiPlanNotice feature="AI RFP generation" />
      <div className="mb-6">
        <Link href="/rfp" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-foreground">
          <ArrowLeft size={16} />
          Back to RFPs
        </Link>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold sm:text-3xl">Create RFP</h2>
        <p className="mt-2 text-muted-foreground">Fill in the details below, then generate a professional RFP draft with AI.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border bg-error-wash px-5 py-4 text-sm font-semibold text-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Basic Information</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2 xl:col-span-2">
              <label className={labelClass}>RFP Title *</label>
              <input className={fieldClass('title')} value={form.title} onChange={(e) => update('title', e.target.value)} required aria-invalid={!!fieldErrors.title} />
              {renderError('title')}
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Client Name *</label>
              <input className={fieldClass('clientName')} value={form.clientName} onChange={(e) => update('clientName', e.target.value)} required aria-invalid={!!fieldErrors.clientName} />
              {renderError('clientName')}
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
              <DateField className={fieldClass('dueDate')} value={form.dueDate} onChange={(v) => update('dueDate', v)} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Estimated Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={fieldClass('estimatedBudget')}
                value={form.estimatedBudget}
                onChange={(e) => update('estimatedBudget', e.target.value)}
                aria-invalid={!!fieldErrors.estimatedBudget}
              />
              {renderError('estimatedBudget')}
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Start Date</label>
              <DateField className={fieldClass('startDate')} value={form.startDate} onChange={(v) => update('startDate', v)} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>End Date</label>
              <DateField className={fieldClass('endDate')} value={form.endDate} onChange={(v) => update('endDate', v)} aria-invalid={!!fieldErrors.endDate} />
              {renderError('endDate')}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Branding</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Logos shown on the generated RFP PDF. The issuer logo falls back to your tenant branding logo if left blank.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <RfpLogoUploadField
              label="Your Company Logo (Issuer)"
              value={form.issuerLogoUrl}
              onChange={(value) => update('issuerLogoUrl', value)}
            />
            <RfpLogoUploadField
              label="Recipient / Client Logo"
              value={form.recipientLogoUrl}
              onChange={(value) => update('recipientLogoUrl', value)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Site Information</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className={labelClass}>Number of Locations</label>
              <input
                type="number"
                min="0"
                step="1"
                className={fieldClass('numberOfLocations')}
                value={form.numberOfLocations}
                onChange={(e) => update('numberOfLocations', e.target.value)}
                aria-invalid={!!fieldErrors.numberOfLocations}
              />
              {renderError('numberOfLocations')}
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
                step="1"
                className={fieldClass('guardsRequired')}
                value={form.guardsRequired}
                onChange={(e) => update('guardsRequired', e.target.value)}
                aria-invalid={!!fieldErrors.guardsRequired}
              />
              {renderError('guardsRequired')}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Pricing Requirements</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass}>Pricing Model</label>
              <select
                className={inputClass}
                value={form.pricingModel}
                onChange={(e) => update('pricingModel', e.target.value)}
              >
                <option value="" className="bg-[#0e0e1a]">Select a pricing model</option>
                {PRICING_MODEL_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#0e0e1a]">
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Payment Terms</label>
              <input
                placeholder="e.g. Net 30 Days"
                className={inputClass}
                value={form.paymentTerms}
                onChange={(e) => update('paymentTerms', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Pricing Validity</label>
              <input
                placeholder="e.g. 90 Days"
                className={inputClass}
                value={form.pricingValidity}
                onChange={(e) => update('pricingValidity', e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className={labelClass}>Pricing Components</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {PRICING_COMPONENT_OPTIONS.map((item) => {
                const active = form.requiredPricingItems.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => togglePricingItem(item)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-indigo-400/40 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className={labelClass}>Pricing Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="Pricing should include all taxes, equipment, insurance, permits, and any additional operational costs. No hidden fees."
              value={form.pricingNotes}
              onChange={(e) => update('pricingNotes', e.target.value)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
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
          <section ref={generatedSectionRef} tabIndex={-1} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold text-white">Generated RFP Document</h3>
              <p className="text-xs text-muted-foreground">Saved automatically. Review and edit this draft, then save your changes when ready.</p>
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
