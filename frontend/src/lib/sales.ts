import platformApi from '@/lib/platform-api';
import type { PackageKey } from '@/lib/billing';

export const NO_PLAN_SALE_KEY = 'NO_PLAN' as const;
export type SaleTarget = PackageKey | typeof NO_PLAN_SALE_KEY;

export interface SaleCampaign {
  id: string;
  name: string;
  percentOff: number;
  bonusCredits: number;
  packageKeys: SaleTarget[];
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  createdAt: string;
}

export type SaleInput = Omit<SaleCampaign, 'id' | 'createdAt'>;

export async function listSales(): Promise<SaleCampaign[]> {
  return (await platformApi.get<SaleCampaign[]>('platform/sales')).data;
}

export async function createSale(input: SaleInput): Promise<void> {
  await platformApi.post('platform/sales', input);
}

export async function updateSale(id: string, input: SaleInput): Promise<void> {
  await platformApi.put(`platform/sales/${id}`, input);
}

export async function setSaleEnabled(
  id: string,
  enabled: boolean,
): Promise<void> {
  await platformApi.patch(`platform/sales/${id}/enabled`, { enabled });
}

export async function deleteSale(id: string): Promise<void> {
  await platformApi.delete(`platform/sales/${id}`);
}
