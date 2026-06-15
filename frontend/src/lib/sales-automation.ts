import api from '@/lib/api';

export interface SalesAutomationSummary {
  tenantId?: string;
  scannedDeals: number;
  createdActivities: number;
  skippedDeals: number;
  errors: Array<{ dealId?: string; message: string }>;
}

export interface SalesAutomationStatus {
  enabled: boolean;
  intervalMinutes: number;
  running: boolean;
  lastRunAt: string | null;
  lastRunSummary: SalesAutomationSummary | null;
  marker: string;
}

export async function getSalesAutomationStatus() {
  const res = await api.get<SalesAutomationStatus>('sales-automation/status');
  return res.data;
}

export async function runSalesAutomation() {
  const res = await api.post<SalesAutomationSummary>('sales-automation/run');
  return res.data;
}
