import api from './api';

export interface VendorInvitation {
  companyName: string;
  rfpTitle: string;
  industry: string | null;
  dueDate: string | null;
  additionalRequirements: string | null;
  securityTypes: string[];
  invitationStatus: 'PENDING' | 'INVITED' | 'VIEWED' | 'SUBMITTED';
  alreadySubmitted: boolean;
}

export async function getVendorInvitation(token: string) {
  const response = await api.get<VendorInvitation>(`vendor/invitation/${token}`);
  return response.data;
}

export async function markInvitationViewed(token: string) {
  const response = await api.post<{ success: boolean }>(`vendor/invitation/${token}/view`);
  return response.data;
}

export interface SubmitProposalFiles {
  proposalFile?: File | null;
  pricingFile?: File | null;
  insuranceFile?: File | null;
  licenseFile?: File | null;
}

export async function submitVendorProposal(
  token: string,
  files: SubmitProposalFiles,
  notes?: string,
) {
  const formData = new FormData();
  if (files.proposalFile) formData.append('proposalFile', files.proposalFile);
  if (files.pricingFile) formData.append('pricingFile', files.pricingFile);
  if (files.insuranceFile) formData.append('insuranceFile', files.insuranceFile);
  if (files.licenseFile) formData.append('licenseFile', files.licenseFile);
  if (notes) formData.append('notes', notes);

  const response = await api.post<{ success: boolean }>(`vendor/invitation/${token}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
