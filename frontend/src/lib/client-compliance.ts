import api from './api';
import { downloadBlobFile } from './csv';

// Mirrors backend/src/client-compliance/client-insurance-types.constants.ts.
export const CLIENT_INSURANCE_TYPES = [
  'general_liability',
  'workers_comp',
  'professional_liability',
  'umbrella',
  'certificate_of_insurance',
  'other',
] as const;
export type ClientInsuranceType = (typeof CLIENT_INSURANCE_TYPES)[number];

export const CLIENT_INSURANCE_TYPE_LABELS: Record<ClientInsuranceType, string> = {
  general_liability: 'General Liability',
  workers_comp: "Workers' Compensation",
  professional_liability: 'Professional Liability',
  umbrella: 'Umbrella / Excess',
  certificate_of_insurance: 'Certificate of Insurance (COI)',
  other: 'Other',
};

export type ComplianceStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING';

export interface ClientInsurancePolicy {
  // null only for a synthesized MISSING row - no policy exists yet.
  id: string | null;
  clientId: string;
  clientName: string;
  siteId: string | null;
  siteName: string | null;
  scope: 'client_wide' | 'site';
  type: string;
  status: ComplianceStatus;
  policyNumber: string | null;
  insurer: string | null;
  coverageAmount: number | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  notes: string | null;
  hasDocument: boolean;
  fileName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ClientInsuranceSummary {
  total: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  missing: number;
}

export interface ClientInsurancePolicyInput {
  client_id: string;
  site_id?: string | null;
  type: string;
  policy_number?: string;
  insurer?: string;
  coverage_amount?: number;
  effective_date?: string;
  expiration_date?: string;
  notes?: string;
}

export interface ClientComplianceFilters {
  client_id?: string;
  site_id?: string;
  status?: ComplianceStatus;
  type?: string;
}

export async function getClientInsurancePolicies(
  filters: ClientComplianceFilters = {},
): Promise<ClientInsurancePolicy[]> {
  const res = await api.get<ClientInsurancePolicy[]>('client-compliance', {
    params: filters,
  });
  return res.data;
}

export async function getClientInsuranceSummary(
  clientId?: string,
): Promise<ClientInsuranceSummary> {
  const res = await api.get<ClientInsuranceSummary>('client-compliance/summary', {
    params: clientId ? { client_id: clientId } : undefined,
  });
  return res.data;
}

export async function createClientInsurancePolicy(
  input: ClientInsurancePolicyInput,
): Promise<ClientInsurancePolicy> {
  const res = await api.post<ClientInsurancePolicy>('client-compliance', input);
  return res.data;
}

export async function updateClientInsurancePolicy(
  id: string,
  input: Partial<Omit<ClientInsurancePolicyInput, 'client_id'>>,
): Promise<ClientInsurancePolicy> {
  const res = await api.put<ClientInsurancePolicy>(`client-compliance/${id}`, input);
  return res.data;
}

export async function deleteClientInsurancePolicy(id: string): Promise<void> {
  await api.delete(`client-compliance/${id}`);
}

export async function uploadClientInsuranceDocument(
  id: string,
  file: File,
): Promise<ClientInsurancePolicy> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<ClientInsurancePolicy>(
    `client-compliance/${id}/document`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
}

export async function downloadClientInsuranceDocument(
  id: string,
  fallbackFilename: string,
  base: 'client-compliance' | 'client/insurance' = 'client-compliance',
): Promise<void> {
  const res = await api.get(`${base}/${id}/document`, { responseType: 'blob' });
  downloadBlobFile(fallbackFilename, res.data as Blob);
}

// Client-portal read-only view of the caller's own policies.
export async function getMyInsurancePolicies(): Promise<ClientInsurancePolicy[]> {
  const res = await api.get<ClientInsurancePolicy[]>('client/insurance');
  return res.data;
}
