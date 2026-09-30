'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ColumnMapping,
  FIELD_LABELS,
  IMPORTABLE_FIELDS,
  ImportableField,
  ImportPreview,
  ImportResult,
  REQUIRED_FIELDS,
  commitLeadImport,
  previewLeadImport,
} from '@/lib/lead-import';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, FileUp, Loader2, Upload } from 'lucide-react';

/** Sentinel for "do not import this field" - Radix Select disallows empty values. */
const UNMAPPED = '__unmapped__';

type Step = 'upload' | 'map' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import so the caller can refresh its list. */
  onImported?: () => void;
}

export default function LeadImportDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setError(null);
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const errorMessage = (err: unknown) => {
    const response = (err as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message || 'Something went wrong. Please try again.';
  };

  const handleFile = async (selected: File) => {
    setBusy(true);
    setError(null);
    try {
      const result = await previewLeadImport(selected);
      setFile(selected);
      setPreview(result);
      setMapping(result.suggestedMapping);
      setStep('map');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * A name is satisfiable by a mapped column or, when the export splits it,
   * by first/last columns the server joins - so mirror that rule here.
   */
  const hasSplitName = useMemo(() => {
    if (!preview) return false;
    const normalized = preview.headers.map((header) =>
      header.trim().toLowerCase().replace(/[_\-.]+/g, ' '),
    );
    const hasFirst = normalized.some((header) =>
      ['first name', 'firstname', 'given name'].includes(header),
    );
    const hasLast = normalized.some((header) =>
      ['last name', 'lastname', 'surname', 'family name'].includes(header),
    );
    return hasFirst && hasLast;
  }, [preview]);

  const missingRequired = REQUIRED_FIELDS.filter((field) =>
    field === 'name' ? !mapping.name && !hasSplitName : !mapping[field],
  );

  const setField = (field: ImportableField, header: string) => {
    setMapping((current) => {
      const next = { ...current };
      if (header === UNMAPPED) {
        delete next[field];
        return next;
      }
      // One column feeds one field, so release it from whatever held it.
      for (const key of IMPORTABLE_FIELDS) {
        if (key !== field && next[key] === header) delete next[key];
      }
      next[field] = header;
      return next;
    });
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const imported = await commitLeadImport(file, mapping, preview?.detectedCrm);
      setResult(imported);
      setStep('done');
      onImported?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import leads from your CRM</DialogTitle>
          <DialogDescription>
            Export contacts as CSV from any CRM &mdash; HubSpot, Salesforce, Pipedrive, Zoho,
            GoHighLevel or anything else &mdash; then match its columns to your lead fields.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-wash p-3 text-sm text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'upload' && (
          <div className="relative flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 p-10 text-center">
            {busy ? (
              <Loader2 size={28} className="animate-spin text-primary" />
            ) : (
              <FileUp size={28} className="text-primary" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {busy ? 'Reading your file...' : 'Choose a CSV export'}
              </p>
              <p className="text-xs text-muted-foreground">
                We read the column names and suggest a mapping for you.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) void handleFile(selected);
              }}
            />
          </div>
        )}

        {step === 'map' && preview && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{file?.name}</span>
              <span>&middot;</span>
              <span>{preview.totalRows} rows</span>
              {preview.detectedCrm && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Looks like {preview.detectedCrm}
                </span>
              )}
            </div>

            <div className="space-y-3">
              {IMPORTABLE_FIELDS.map((field) => {
                const isRequired = REQUIRED_FIELDS.includes(field);
                const unsatisfied = field === 'name' ? !mapping.name && !hasSplitName : !mapping[field];
                return (
                  <div key={field} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[180px_1fr]">
                    <label className="text-sm font-medium text-foreground">
                      {FIELD_LABELS[field]}
                      {isRequired && <span className="ml-1 text-error">*</span>}
                    </label>
                    <Select
                      value={mapping[field] ?? UNMAPPED}
                      onValueChange={(value) => setField(field, value)}
                    >
                      <SelectTrigger
                        className={cn(isRequired && unsatisfied && 'border-error/50')}
                      >
                        <SelectValue placeholder="Not imported" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED}>Not imported</SelectItem>
                        {preview.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            {hasSplitName && !mapping.name && (
              <p className="text-xs text-muted-foreground">
                This export splits the name across first and last name columns &mdash; we will join
                them automatically.
              </p>
            )}

            {missingRequired.length > 0 && (
              <p className="text-xs text-error">
                Map a column to: {missingRequired.map((field) => FIELD_LABELS[field]).join(', ')}
              </p>
            )}

            {preview.rows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Preview
                </p>
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.headers.map((header) => (
                          <TableHead key={header} className="whitespace-nowrap">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.slice(0, 5).map((row, index) => (
                        <TableRow key={index}>
                          {preview.headers.map((header) => (
                            <TableCell key={header} className="whitespace-nowrap text-xs">
                              {row[header] || '—'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={busy}>
                Choose another file
              </Button>
              <Button onClick={runImport} disabled={busy || missingRequired.length > 0}>
                {busy ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    Import {preview.totalRows} rows
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-wash p-4">
              <CheckCircle2 size={20} className="text-success" />
              <p className="text-sm text-foreground">
                Imported <strong>{result.created}</strong> new leads and updated{' '}
                <strong>{result.updated}</strong> existing ones
                {result.skipped > 0 && <> &middot; {result.skipped} rows skipped</>}.
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-white/10 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Skipped rows
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.errors.slice(0, 10).map((issue) => (
                    <li key={issue.row}>
                      Row {issue.row}: {issue.reason}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>and {result.errors.length - 10} more...</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Import another file
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
