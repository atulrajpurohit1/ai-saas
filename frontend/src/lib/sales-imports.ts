import api from '@/lib/api';

export type SalesImportTarget = 'leads' | 'deals';

export type SalesImportField =
  | 'name'
  | 'company'
  | 'email'
  | 'status'
  | 'dealName'
  | 'stage'
  | 'propertyType'
  | 'buyerRole'
  | 'currentProvider'
  | 'guardCount'
  | 'serviceHours'
  | 'painPoints'
  | 'riskConcerns'
  | 'decisionTimeline'
  | 'budgetSensitivity'
  | 'objections'
  | 'notes';

export type SalesImportMapping = Partial<Record<SalesImportField, string>>;

export interface SalesImportPreview {
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  previewRows: number;
  totalRows: number;
  detectedMapping: SalesImportMapping;
  requiredFields: {
    leads: SalesImportField[];
    deals: SalesImportField[];
  };
}

export interface SalesImportResult {
  target: SalesImportTarget;
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  leadsCreated: number;
  leadsUpdated: number;
  leadsMatched: number;
  dealsCreated: number;
  dealsUpdated: number;
  dealsMatched: number;
  discoverySessionsCreated: number;
  errors: Array<{ row: number; message: string }>;
}

export async function previewSalesImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<SalesImportPreview>('sales-imports/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function commitSalesImport(
  file: File,
  target: SalesImportTarget,
  mapping: SalesImportMapping,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target', target);
  formData.append('mapping', JSON.stringify(mapping));
  const res = await api.post<SalesImportResult>('sales-imports/commit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
