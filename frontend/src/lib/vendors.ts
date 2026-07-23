import api from './api';

export type VendorStatus = 'ACTIVE' | 'INACTIVE';

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
