import api from './api';
import { downloadBlobFile } from './csv';

// Mirrors backend/src/guard-compliance/compliance-types.constants.ts exactly.
export const GUARD_COMPLIANCE_TYPES = [
  'guard_license',
  'firearm_permit',
  'training_certification',
  'background_check',
  'certificate_of_insurance',
  'other',
] as const;
export type GuardComplianceType = (typeof GUARD_COMPLIANCE_TYPES)[number];

export const GUARD_COMPLIANCE_TYPE_LABELS: Record<GuardComplianceType, string> = {
  guard_license: 'Guard License',
  firearm_permit: 'Firearm Permit',
  training_certification: 'Training Certification',
  background_check: 'Background Check',
  certificate_of_insurance: 'Certificate of Insurance (COI)',
  other: 'Other',
};

export type ComplianceStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING';

export interface GuardComplianceRecord {
  // null only for a synthesized MISSING entry - no record exists yet.
  id: string | null;
  guardId: string;
  guardName: string;
  type: string;
  status: ComplianceStatus;
  documentNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  notes: string | null;
  hasDocument: boolean;
  fileName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GuardComplianceInput {
  guard_id: string;
  type: string;
  document_number?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiration_date?: string;
  notes?: string;
}

export async function getGuardCompliance(guardId?: string): Promise<GuardComplianceRecord[]> {
  const res = await api.get<GuardComplianceRecord[]>('guard-compliance', {
    params: guardId ? { guard_id: guardId } : undefined,
  });
  return res.data;
}

export async function createGuardCompliance(input: GuardComplianceInput): Promise<GuardComplianceRecord> {
  const res = await api.post<GuardComplianceRecord>('guard-compliance', input);
  return res.data;
}

export async function updateGuardCompliance(
  id: string,
  input: Partial<Omit<GuardComplianceInput, 'guard_id'>>,
): Promise<GuardComplianceRecord> {
  const res = await api.put<GuardComplianceRecord>(`guard-compliance/${id}`, input);
  return res.data;
}

export async function deleteGuardCompliance(id: string): Promise<void> {
  await api.delete(`guard-compliance/${id}`);
}

export async function uploadGuardComplianceDocument(id: string, file: File): Promise<GuardComplianceRecord> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<GuardComplianceRecord>(`guard-compliance/${id}/document`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function downloadGuardComplianceDocument(id: string, fallbackFilename: string): Promise<void> {
  const response = await api.get(`guard-compliance/${id}/document`, { responseType: 'blob' });
  downloadBlobFile(fallbackFilename, response.data as Blob);
}
