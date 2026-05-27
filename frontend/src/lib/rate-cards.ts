import api from './api';

export type RateCardStatus = 'active' | 'inactive';

export interface RateCard {
  id: string;
  tenantId: string;
  clientId: string;
  siteId: string | null;
  roleName: string | null;
  hourlyRate: number;
  overtimeRate: number | null;
  holidayRate: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: RateCardStatus;
  createdAt: string;
  client: {
    id: string;
    name: string;
    companyName: string | null;
    email: string;
  } | null;
  site: {
    id: string;
    name: string;
    address: string;
  } | null;
}

export interface RateCardInput {
  client_id: string;
  site_id?: string | null;
  role_name?: string;
  hourly_rate: number;
  overtime_rate?: number;
  holiday_rate?: number;
  effective_from: string;
  effective_to?: string;
  status?: RateCardStatus;
}

export async function getRateCards(status?: RateCardStatus) {
  const response = await api.get<RateCard[]>('rate-cards', {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function getRateCard(id: string) {
  const response = await api.get<RateCard>(`rate-cards/${id}`);
  return response.data;
}

export async function createRateCard(input: RateCardInput) {
  const response = await api.post<RateCard>('rate-cards', input);
  return response.data;
}

export async function updateRateCard(id: string, input: Partial<RateCardInput>) {
  const response = await api.put<RateCard>(`rate-cards/${id}`, input);
  return response.data;
}

export async function deactivateRateCard(id: string) {
  const response = await api.delete<RateCard>(`rate-cards/${id}`);
  return response.data;
}
