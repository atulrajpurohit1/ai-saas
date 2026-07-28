import api from './api';
import { downloadBlobFile } from './csv';

export type VendorStatus = 'ACTIVE' | 'INACTIVE';
export type InvitationStatus = 'PENDING' | 'INVITED' | 'VIEWED' | 'SUBMITTED';

export interface Vendor {
  id: string;
  tenantId: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  services: string[];
  notes: string | null;
  status: VendorStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorInput {
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  services?: string[];
  notes?: string;
  status?: VendorStatus;
}

export async function getVendors(search?: string) {
  const response = await api.get<Vendor[]>('vendors', {
    params: search ? { search } : undefined,
  });
  return response.data;
}

export async function getVendor(id: string) {
  const response = await api.get<Vendor>(`vendors/${id}`);
  return response.data;
}

export async function createVendor(input: VendorInput) {
  const response = await api.post<Vendor>('vendors', input);
  return response.data;
}

export async function updateVendor(id: string, input: Partial<VendorInput>) {
  const response = await api.patch<Vendor>(`vendors/${id}`, input);
  return response.data;
}

export async function deleteVendor(id: string) {
  const response = await api.delete<{ success: boolean }>(`vendors/${id}`);
  return response.data;
}

export async function getAssignedVendors(rfpId: string) {
  const response = await api.get<Vendor[]>(`rfp/${rfpId}/vendors`);
  return response.data;
}

export async function assignVendorsToRfp(rfpId: string, vendorIds: string[]) {
  const response = await api.post<Vendor[]>(`rfp/${rfpId}/vendors`, { vendorIds });
  return response.data;
}

export async function removeVendorFromRfp(rfpId: string, vendorId: string) {
  const response = await api.delete<{ success: boolean }>(`rfp/${rfpId}/vendors/${vendorId}`);
  return response.data;
}

export interface ProposalSubmission {
  id: string;
  proposalFile: string | null;
  pricingFile: string | null;
  insuranceFile: string | null;
  licenseFile: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RfpVendorSubmission {
  id: string;
  rfpId: string;
  vendorId: string;
  invitationStatus: InvitationStatus;
  invitedAt: string | null;
  viewedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  vendor: Vendor;
  submission: ProposalSubmission | null;
}

export async function inviteVendorsToRfp(rfpId: string, vendorIds: string[]) {
  const response = await api.post<{ invited: string[]; skippedNoEmail: string[]; emailFailed: string[] }>(
    `rfp/${rfpId}/invite`,
    { vendorIds },
  );
  return response.data;
}

export async function getRfpSubmissions(rfpId: string) {
  const response = await api.get<RfpVendorSubmission[]>(`rfp/${rfpId}/submissions`);
  return response.data;
}

export const SUBMISSION_DOCUMENT_FIELDS = [
  { field: 'proposalFile', label: 'Proposal PDF' },
  { field: 'pricingFile', label: 'Pricing Sheet' },
  { field: 'insuranceFile', label: 'Insurance Certificate' },
  { field: 'licenseFile', label: 'Security License' },
] as const;

export async function downloadSubmissionFile(rfpId: string, vendorId: string, field: string, filename: string) {
  const response = await api.get(`rfp/${rfpId}/submissions/${vendorId}/download/${field}`, {
    responseType: 'blob',
  });
  downloadBlobFile(filename, response.data as Blob);
}
