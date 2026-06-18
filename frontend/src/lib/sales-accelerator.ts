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

export async function analyzeDiscoveryCall(
  entityType: 'leads' | 'deals',
  entityId: string,
  transcript: string,
) {
  const res = await api.post(`sales-accelerator/${entityType}/${entityId}/discovery-call`, {
    transcript,
  });
  return res.data?.intelligence ?? res.data;
}

export async function coachDiscoveryCall(
  entityType: 'leads' | 'deals',
  entityId: string,
  transcript: string,
) {
  const res = await api.post(`sales-accelerator/${entityType}/${entityId}/live-coach`, {
    transcript,
  });
  return res.data?.coach ?? res.data;
}
