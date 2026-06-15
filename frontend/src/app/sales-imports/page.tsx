'use client';

import React, { useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  commitSalesImport,
  previewSalesImport,
  type SalesImportField,
  type SalesImportMapping,
  type SalesImportPreview,
  type SalesImportResult,
  type SalesImportTarget,
} from '@/lib/sales-imports';

const FIELD_DEFINITIONS: Array<{
  key: SalesImportField;
  label: string;
  help: string;
  targets: SalesImportTarget[];
  required?: SalesImportTarget[];
}> = [
  { key: 'name', label: 'Contact name', help: 'Primary buyer or lead contact.', targets: ['leads', 'deals'], required: ['leads', 'deals'] },
  { key: 'company', label: 'Company', help: 'Account, property, or organization name.', targets: ['leads', 'deals'], required: ['leads', 'deals'] },
  { key: 'email', label: 'Email', help: 'Contact email for matching and follow-up.', targets: ['leads', 'deals'] },
  { key: 'status', label: 'Lead status', help: 'Existing lead status from the sheet.', targets: ['leads', 'deals'] },
  { key: 'dealName', label: 'Deal name', help: 'Opportunity title to create or sync.', targets: ['deals'], required: ['deals'] },
  { key: 'stage', label: 'Deal stage', help: 'Pipeline stage for imported deals.', targets: ['deals'] },
  { key: 'propertyType', label: 'Property type', help: 'Apartment, warehouse, office, retail, or similar.', targets: ['leads', 'deals'] },
  { key: 'buyerRole', label: 'Buyer role', help: 'Decision maker title or influence level.', targets: ['leads', 'deals'] },
  { key: 'currentProvider', label: 'Current provider', help: 'Incumbent security vendor.', targets: ['leads', 'deals'] },
  { key: 'guardCount', label: 'Guard count', help: 'Known posts or guards required.', targets: ['leads', 'deals'] },
  { key: 'serviceHours', label: 'Service hours', help: 'Coverage windows, shifts, or schedule.', targets: ['leads', 'deals'] },
  { key: 'painPoints', label: 'Pain points', help: 'Operational issues with current coverage.', targets: ['leads', 'deals'] },
  { key: 'riskConcerns', label: 'Risk concerns', help: 'Incidents, liability, theft, trespass, or exposure.', targets: ['leads', 'deals'] },
  { key: 'decisionTimeline', label: 'Decision timeline', help: 'Start date, renewal, or urgency signal.', targets: ['leads', 'deals'] },
  { key: 'budgetSensitivity', label: 'Budget sensitivity', help: 'Price concern or budget context.', targets: ['leads', 'deals'] },
  { key: 'objections', label: 'Objections', help: 'Known buyer objections or blockers.', targets: ['leads', 'deals'] },
  { key: 'notes', label: 'Notes', help: 'General notes to attach to discovery.', targets: ['leads', 'deals'] },
];

const emptyMapping: SalesImportMapping = {};

export default function SalesImportsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<SalesImportTarget>('leads');
  const [preview, setPreview] = useState<SalesImportPreview | null>(null);
  const [mapping, setMapping] = useState<SalesImportMapping>(emptyMapping);
  const [result, setResult] = useState<SalesImportResult | null>(null);
  const [loading, setLoading] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState('');

  const visibleFields = useMemo(
    () => FIELD_DEFINITIONS.filter((field) => field.targets.includes(target)),
    [target],
  );

  const missingRequired = visibleFields
    .filter((field) => field.required?.includes(target))
    .filter((field) => !mapping[field.key]);

  const handlePreview = async () => {
    if (!file) return;
    setError('');
    setResult(null);
    setLoading('preview');
    try {
      const nextPreview = await previewSalesImport(file);
      setPreview(nextPreview);
      setMapping(nextPreview.detectedMapping);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to preview this CSV.');
    } finally {
      setLoading(null);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview || missingRequired.length > 0) return;
    setError('');
    setLoading('commit');
    try {
      const nextResult = await commitSalesImport(file, target, mapping);
      setResult(nextResult);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Import failed.');
    } finally {
      setLoading(null);
    }
  };

  const updateMapping = (field: SalesImportField, value: string) => {
    setMapping((current) => {
      const next = { ...current };
      if (value) next[field] = value;
      else delete next[field];
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Sales Imports</h2>
          <p className="text-muted-foreground">Map CSV columns into leads, deals, and sales discovery signals.</p>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
          {(['leads', 'deals'] as SalesImportTarget[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTarget(item);
                setResult(null);
              }}
              className={`rounded-md px-4 py-2 text-sm font-bold capitalize transition ${
                target === item ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Upload CSV</h3>
              <p className="text-sm text-muted-foreground">Preview before writing records.</p>
            </div>
          </div>

          <label className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 bg-white/5 p-6 text-center transition hover:bg-white/10">
            <Upload size={24} className="text-indigo-300" />
            <div>
              <p className="font-bold">{file ? file.name : 'Choose a CSV file'}</p>
              <p className="mt-1 text-xs text-muted-foreground">CSV headers are used for auto-detection.</p>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="absolute inset-0 opacity-0"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
                setPreview(null);
                setResult(null);
                setMapping(emptyMapping);
                setError('');
              }}
            />
          </label>

          <button
            type="button"
            onClick={handlePreview}
            disabled={!file || loading !== null}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === 'preview' ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
            Preview Columns
          </button>

          {preview && (
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xl font-bold">{preview.totalRows}</p>
                <p className="text-xs text-muted-foreground">Rows</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xl font-bold">{preview.headers.length}</p>
                <p className="text-xs text-muted-foreground">Columns</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xl font-bold">{Object.keys(preview.detectedMapping).length}</p>
                <p className="text-xs text-muted-foreground">Matched</p>
              </div>
            </div>
          )}
        </section>

        <section className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-bold">Column Mapping</h3>
              <p className="text-sm text-muted-foreground">Map your spreadsheet fields to CRM and discovery data.</p>
            </div>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!preview || missingRequired.length > 0 || loading !== null}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === 'commit' ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              Run Import
            </button>
          </div>

          {!preview ? (
            <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-muted-foreground">
              Upload a CSV and preview it to start mapping fields.
            </div>
          ) : (
            <div className="space-y-6">
              {missingRequired.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Required before import: {missingRequired.map((field) => field.label).join(', ')}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {visibleFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="flex items-center justify-between gap-3 text-sm font-semibold">
                      <span>{field.label}</span>
                      {field.required?.includes(target) && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Required</span>
                      )}
                    </label>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(event) => updateMapping(field.key, event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400"
                    >
                      <option value="">Do not import</option>
                      {preview.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">{field.help}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-lg border border-white/10">
                <div className="border-b border-white/10 bg-white/5 px-4 py-3 text-sm font-bold">Sample Rows</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        {preview.headers.slice(0, 6).map((header) => (
                          <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {preview.sampleRows.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          {preview.headers.slice(0, 6).map((header) => (
                            <td key={header} className="max-w-52 truncate px-4 py-3 text-slate-300">
                              {row[header] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {result && (
        <section className="mt-6 glass-card rounded-lg border border-emerald-500/20 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3 text-emerald-200">
            <CheckCircle2 size={22} />
            <h3 className="text-lg font-bold">Import Complete</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Rows processed" value={result.processedRows} />
            <Metric label="Leads created" value={result.leadsCreated} />
            <Metric label="Deals created" value={result.dealsCreated} />
            <Metric label="Discovery captured" value={result.discoverySessionsCreated} />
          </div>
          {result.errors.length > 0 && (
            <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="mb-2 text-sm font-bold text-amber-100">Rows needing review</p>
              <div className="max-h-40 space-y-1 overflow-y-auto text-sm text-amber-50/90">
                {result.errors.slice(0, 20).map((item) => (
                  <p key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
