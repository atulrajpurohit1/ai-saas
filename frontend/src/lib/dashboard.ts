import api from './api';

export interface PeriodMetric {
  total: number;
  last7Days: number;
  previous7Days: number;
  deltaPct: number | null;
}

export interface DashboardSummary {
  leads: PeriodMetric & { weeklyTrend: { weekStart: string; count: number }[] };
  deals: PeriodMetric & { active: number; byStage: { stage: string; count: number }[] };
  proposals: PeriodMetric & { sent: number };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await api.get<DashboardSummary>('dashboard/summary');
  return res.data;
}
