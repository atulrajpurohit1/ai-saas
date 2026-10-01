import api from './api';

/**
 * Field-mapped CSV import - the vendor-neutral way to bring leads in from any
 * CRM. The user previews their export, confirms which column feeds which lead
 * field, then commits.
 */

export const IMPORTABLE_FIELDS = ['name', 'company', 'email', 'status'] as const;

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];

export type ColumnMapping = Partial<Record<ImportableField, string>>;

export interface ImportPreview {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  suggestedMapping: ColumnMapping;
  detectedCrm: string | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  totalRows: number;
  errors: { row: number; reason: string }[];
}

export const FIELD_LABELS: Record<ImportableField, string> = {
  name: 'Contact name',
  company: 'Company',
  email: 'Email',
  status: 'Status',
};

export const REQUIRED_FIELDS: ImportableField[] = ['name', 'company'];

export async function previewLeadImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<ImportPreview>('leads/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function commitLeadImport(
  file: File,
  mapping: ColumnMapping,
  source?: string | null,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));
  if (source) formData.append('source', source);

  const res = await api.post<ImportResult>('leads/import/commit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
