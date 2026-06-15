import api from '@/lib/api';

export async function getSalesAlerts() {
  const res = await api.get('sales-accelerator/alerts');
  return res.data;
}

export async function getSalesForecastReport() {
  const res = await api.get('sales-accelerator/forecast-report');
  return res.data;
}

export async function getSalesCoachingAnalytics() {
  const res = await api.get('sales-accelerator/coaching-analytics');
  return res.data;
}

export async function getSalesLearningLoop() {
  const res = await api.get('sales-accelerator/learning-loop');
  return res.data;
}
