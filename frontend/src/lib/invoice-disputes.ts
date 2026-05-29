import api from './api';
import { InvoiceDisputeStatus } from './invoices';

export interface AdminInvoiceDispute {
  id: string;
  invoiceId: string;
  clientId: string;
  tenantId: string;
  reason: string;
  description: string;
  status: InvoiceDisputeStatus;
  adminResponse: string | null;
  createdAt: string;
  resolvedAt: string | null;
  client: {
    id: string;
    name: string;
    companyName: string | null;
    email: string;
  } | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    billingStartDate: string;
    billingEndDate: string;
    totalAmount: number;
    issuedAt: string | null;
    site: {
      id: string;
      name: string;
      address: string;
    } | null;
  } | null;
}

export async function getInvoiceDisputes() {
  const response = await api.get<AdminInvoiceDispute[]>('invoice-disputes');
  return response.data;
}

export async function getInvoiceDispute(id: string) {
  const response = await api.get<AdminInvoiceDispute>(`invoice-disputes/${id}`);
  return response.data;
}

export async function respondToInvoiceDispute(id: string, adminResponse: string) {
  const response = await api.post<AdminInvoiceDispute>(`invoice-disputes/${id}/respond`, {
    admin_response: adminResponse,
  });
  return response.data;
}

export async function resolveInvoiceDispute(id: string, adminResponse?: string) {
  const response = await api.post<AdminInvoiceDispute>(`invoice-disputes/${id}/resolve`, {
    admin_response: adminResponse || undefined,
  });
  return response.data;
}

export async function rejectInvoiceDispute(id: string, adminResponse?: string) {
  const response = await api.post<AdminInvoiceDispute>(`invoice-disputes/${id}/reject`, {
    admin_response: adminResponse || undefined,
  });
  return response.data;
}
