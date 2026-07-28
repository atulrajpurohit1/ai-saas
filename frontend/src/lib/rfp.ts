import api from './api';
import { downloadBlobFile } from './csv';

export type RfpStatus = 'DRAFT' | 'GENERATED' | 'FINALIZED' | 'EVALUATED' | 'AWARDED';

export const SECURITY_TYPE_OPTIONS = [
  'Armed',
  'Unarmed',
  'Patrol',
  'Mobile Patrol',
  'Fire Watch',
  'Event Security',
  'Concierge',
  'CCTV Monitoring',
] as const;

export interface EvaluationReport {
  id: string;
  rfpId: string;
  summary: string;
  recommendedVendor: string | null;
  overallAnalysis: string;
  generatedReport: string;
  createdAt: string;
}

export interface Rfp {
  id: string;
  tenantId: string;
  title: string;
  clientName: string;
  companyName: string | null;
  industry: string | null;
  projectName: string | null;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  estimatedBudget: number | null;
  securityTypes: string[];
  numberOfLocations: number | null;
  address: string | null;
  operatingHours: string | null;
  guardsRequired: number | null;
  additionalRequirements: string | null;
  generatedContent: string | null;
  status: RfpStatus;
  createdBy: string | null;
  createdByUser: { id: string; name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
  evaluation: EvaluationReport | null;
  awardedVendorId: string | null;
  awardDate: string | null;
  awardNotes: string | null;
  rejectedVendorIds: string[];
  awardedVendor: { id: string; companyName: string; contactPerson: string | null; email: string | null } | null;
}

export interface RfpFormInput {
  title: string;
  clientName: string;
  companyName?: string;
  industry?: string;
  projectName?: string;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  estimatedBudget?: number;
  securityTypes?: string[];
  numberOfLocations?: number;
  address?: string;
  operatingHours?: string;
  guardsRequired?: number;
  additionalRequirements?: string;
}

export interface RfpInput extends RfpFormInput {
  generatedContent?: string;
  status?: RfpStatus;
}

export async function getRfps() {
  const response = await api.get<Rfp[]>('rfp');
  return response.data;
}

export async function getRfp(id: string) {
  const response = await api.get<Rfp>(`rfp/${id}`);
  return response.data;
}

export async function generateEvaluation(id: string) {
  const response = await api.post<EvaluationReport>(`rfp/${id}/evaluate`);
  return response.data;
}

export async function awardContract(id: string, vendorId: string, awardNotes?: string) {
  const response = await api.post<Rfp>(`rfp/${id}/award`, { vendorId, awardNotes });
  return response.data;
}

export async function rejectVendor(id: string, vendorId: string, reason?: string) {
  const response = await api.post<{ success: boolean; rejectedVendorIds: string[] }>(
    `rfp/${id}/reject`,
    { vendorId, reason },
  );
  return response.data;
}

export interface VendorPerformanceReview {
  id: string;
  rfpId: string;
  vendorId: string;
  reviewDate: string;
  overallRating: number;
  slaCompliance: number;
  incidentCount: number;
  responseTime: string;
  notes: string | null;
  createdAt: string;
}

export interface PerformanceReviewInput {
  reviewDate?: string;
  overallRating: number;
  slaCompliance: number;
  incidentCount: number;
  responseTime: string;
  notes?: string;
}

export async function getPerformanceReviews(rfpId: string) {
  const response = await api.get<VendorPerformanceReview[]>(`rfp/${rfpId}/performance`);
  return response.data;
}

export async function createPerformanceReview(rfpId: string, input: PerformanceReviewInput) {
  const response = await api.post<VendorPerformanceReview>(`rfp/${rfpId}/performance`, input);
  return response.data;
}

export async function updatePerformanceReview(
  reviewId: string,
  input: Partial<PerformanceReviewInput>,
) {
  const response = await api.patch<VendorPerformanceReview>(`rfp/performance/${reviewId}`, input);
  return response.data;
}

export async function createRfp(input: RfpInput) {
  const response = await api.post<Rfp>('rfp', input);
  return response.data;
}

export async function updateRfp(id: string, input: Partial<RfpInput>) {
  const response = await api.patch<Rfp>(`rfp/${id}`, input);
  return response.data;
}

export async function deleteRfp(id: string) {
  const response = await api.delete<{ success: boolean }>(`rfp/${id}`);
  return response.data;
}

export async function generateRfp(input: RfpFormInput) {
  const response = await api.post<{ content: string }>('rfp/generate', input);
  return response.data;
}

export async function downloadRfpPdf(id: string, title: string) {
  const response = await api.get(`rfp/${id}/pdf`, { responseType: 'blob' });
  downloadBlobFile(`rfp-${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || id}.pdf`, response.data as Blob);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInline(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function isTableRow(line: string) {
  return line.startsWith('|') && line.endsWith('|');
}

function splitTableRow(line: string) {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparatorRow(line: string) {
  if (!isTableRow(line)) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/** Converts the AI's Markdown output (including simple GFM-style tables) into block HTML for the TipTap editor and read-only report views. */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listBuffer: string[] = [];
  let listTag: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listTag && listBuffer.length) {
      html.push(`<${listTag}>${listBuffer.join('')}</${listTag}>`);
    }
    listBuffer = [];
    listTag = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (!line) {
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (isTableRow(line) && isTableSeparatorRow(lines[i + 1]?.trim() || '')) {
      flushList();
      const headerCells = splitTableRow(line);
      const rows: string[][] = [];
      let cursor = i + 2;
      while (cursor < lines.length && isTableRow(lines[cursor].trim())) {
        rows.push(splitTableRow(lines[cursor].trim()));
        cursor += 1;
      }
      i = cursor - 1;

      const headHtml = `<thead><tr>${headerCells.map((cell) => `<th>${formatInline(cell)}</th>`).join('')}</tr></thead>`;
      const bodyHtml = `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${formatInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      html.push(`<table>${headHtml}${bodyHtml}</table>`);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (listTag !== 'ul') {
        flushList();
        listTag = 'ul';
      }
      listBuffer.push(`<li>${formatInline(bulletMatch[1])}</li>`);
      continue;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      if (listTag !== 'ol') {
        flushList();
        listTag = 'ol';
      }
      listBuffer.push(`<li>${formatInline(numberedMatch[1])}</li>`);
      continue;
    }

    flushList();
    html.push(`<p>${formatInline(line)}</p>`);
  }

  flushList();
  return html.join('');
}
