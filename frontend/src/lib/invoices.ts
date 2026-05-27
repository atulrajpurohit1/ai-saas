import api from './api';

export type InvoiceStatus = 'draft' | 'issued' | 'paid';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  rateCardId: string | null;
  shiftId: string;
  guardId: string;
  workedHours: number;
  hourlyRate: number;
  amount: number;
  shift: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  } | null;
  guard: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  rateCard: {
    id: string;
    roleName: string | null;
    hourlyRate: number;
    siteId: string | null;
  } | null;
}

export interface Invoice {
  id: string;
  tenantId: string;
  clientId: string;
  siteId: string;
  invoiceNumber: string;
  billingStartDate: string;
  billingEndDate: string;
  totalHours: number;
  hourlyRate: number;
  subtotal: number;
  tax: number;
  totalAmount: number;
  status: InvoiceStatus;
  createdAt: string;
  issuedAt: string | null;
  rateCardId: string | null;
  rateSource: 'site_rate_card' | 'client_rate_card' | 'manual';
  rateCard: {
    id: string;
    roleName: string | null;
    hourlyRate: number;
    overtimeRate: number | null;
    holidayRate: number | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    status: string;
    clientId: string;
    siteId: string | null;
  } | null;
  client: {
    id: string;
    name: string;
    companyName: string | null;
    email: string;
    phone: string | null;
  } | null;
  site: {
    id: string;
    name: string;
    address: string;
  } | null;
  items: InvoiceItem[];
}

export interface GenerateInvoiceInput {
  client_id: string;
  site_id?: string;
  billing_start_date: string;
  billing_end_date: string;
  hourly_rate?: number;
  allow_manual_rate?: boolean;
}

export async function getAdminInvoices() {
  const response = await api.get<Invoice[]>('invoices');
  return response.data;
}

export async function getAdminInvoice(id: string) {
  const response = await api.get<Invoice>(`invoices/${id}`);
  return response.data;
}

export async function generateInvoice(input: GenerateInvoiceInput) {
  const response = await api.post<Invoice>('invoices/generate', input);
  return response.data;
}

export async function issueInvoice(id: string) {
  const response = await api.post<Invoice>(`invoices/${id}/issue`);
  return response.data;
}

export async function markInvoicePaid(id: string) {
  const response = await api.post<Invoice>(`invoices/${id}/mark-paid`);
  return response.data;
}

export async function getClientInvoices() {
  const response = await api.get<Invoice[]>('client/invoices');
  return response.data;
}

export async function getClientInvoice(id: string) {
  const response = await api.get<Invoice>(`client/invoices/${id}`);
  return response.data;
}
