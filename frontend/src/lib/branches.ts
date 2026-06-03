import api from './api';

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  location: string;
  managerId?: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  manager?: {
    id: string;
    name: string;
    email: string;
  } | null;
  _count?: {
    clients: number;
    sites: number;
    guards: number;
    shifts: number;
    incidents: number;
    invoices: number;
    reports: number;
    users: number;
  };
}

export interface BranchSummary {
  id: string;
  name: string;
  location?: string | null;
  status?: string | null;
}

export async function getBranches() {
  const response = await api.get<Branch[]>('branches');
  return Array.isArray(response.data) ? response.data : [];
}

export async function getBranch(id: string) {
  const response = await api.get<Branch>(`branches/${id}`);
  return response.data;
}

export async function createBranch(payload: { name: string; location: string; status?: string }) {
  const response = await api.post<Branch>('branches', payload);
  return response.data;
}

export async function updateBranch(id: string, payload: { name?: string; location?: string; status?: string }) {
  const response = await api.put<Branch>(`branches/${id}`, payload);
  return response.data;
}

export function branchParams(branchId?: string | null) {
  return branchId ? { branch_id: branchId } : {};
}
