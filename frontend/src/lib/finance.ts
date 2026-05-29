import api from './api';
import { InvoiceStatus } from './invoices';

export type FinanceDisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';

export interface FinanceFilters {
  start_date?: string;
  end_date?: string;
  client_id?: string;
  status?: string;
}

export interface FinanceDashboardSummary {
  totalIssuedAmount: number;
  totalPaidAmount: number;
  outstandingAmount: number;
  disputedAmount: number;
  invoiceCountByStatus: Record<InvoiceStatus, number>;
}

export interface FinanceClient {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
}

export interface FinanceSite {
  id: string;
  name: string;
}

export interface PaymentReportRow {
  invoiceId: string;
  invoiceNumber: string;
  paymentStatus: InvoiceStatus;
  amount: number;
  paidDate: string | null;
  issuedAt: string | null;
  client: FinanceClient | null;
  site: FinanceSite | null;
}

export interface OutstandingReportRow {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: number;
  issuedAt: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  client: FinanceClient | null;
  site: FinanceSite | null;
}

export interface DisputeReportRow {
  disputeId: string;
  invoiceId: string;
  invoiceNumber: string;
  disputeReason: string;
  description: string;
  status: FinanceDisputeStatus;
  amount: number;
  createdAt: string;
  resolvedAt: string | null;
  client: FinanceClient | null;
  invoiceStatus: InvoiceStatus | null;
  site: FinanceSite | null;
}

export const invoiceStatuses: InvoiceStatus[] = ['draft', 'issued', 'disputed', 'resolved', 'paid', 'cancelled'];
export const disputeStatuses: FinanceDisputeStatus[] = ['open', 'under_review', 'resolved', 'rejected'];

export function cleanFinanceFilters(filters: FinanceFilters) {
  const nextFilters: FinanceFilters = { ...filters };

  if (nextFilters.start_date && nextFilters.end_date && nextFilters.end_date < nextFilters.start_date) {
    [nextFilters.start_date, nextFilters.end_date] = [nextFilters.end_date, nextFilters.start_date];
  }

  return Object.fromEntries(
    Object.entries(nextFilters).filter(([, value]) => value !== undefined && value !== '' && value !== 'all'),
  );
}

export async function getFinanceDashboard(filters: FinanceFilters = {}) {
  const response = await api.get<FinanceDashboardSummary>('finance', {
    params: cleanFinanceFilters(filters),
  });
  return response.data;
}

export async function exportFinanceInvoices(filters: FinanceFilters = {}) {
  const response = await api.get<Blob>('finance/export/invoices', {
    params: cleanFinanceFilters(filters),
    responseType: 'blob',
  });
  return response.data;
}

export async function getPaymentReport(filters: FinanceFilters = {}) {
  const response = await api.get<PaymentReportRow[]>('finance/reports/payments', {
    params: cleanFinanceFilters(filters),
  });
  return response.data;
}

export async function getOutstandingReport(filters: FinanceFilters = {}) {
  const response = await api.get<OutstandingReportRow[]>('finance/reports/outstanding', {
    params: cleanFinanceFilters(filters),
  });
  return response.data;
}

export async function getDisputeReport(filters: FinanceFilters = {}) {
  const response = await api.get<DisputeReportRow[]>('finance/reports/disputes', {
    params: cleanFinanceFilters(filters),
  });
  return response.data;
}
