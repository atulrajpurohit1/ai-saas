import api from './api';

// Mirrors backend/src/deals/dto/create-deal.dto.ts DealStage exactly —
// these are the only stage values the backend accepts.
export const DEAL_STAGES = ['New', 'Contacted', 'Proposal', 'Won', 'Lost'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_COLORS: Record<string, string> = {
  new: '#818cf8',
  contacted: '#a78bfa',
  proposal: '#38bdf8',
  won: '#34d399',
  lost: '#fb7185',
};

export interface DealSalesAssessment {
  leadScore: number | null;
  priorityTier: string | null;
  closeReadinessScore: number | null;
  discoveryQualityScore: number | null;
  riskProfile: string | null;
  recommendedNextAction: string | null;
  createdAt: string;
}

export interface Deal {
  id: string;
  name: string;
  stage: string;
  leadId: string;
  clientId: string | null;
  createdAt: string;
  lead: { id: string; name: string; company: string };
  client?: { id: string; name: string; companyName: string } | null;
  salesAssessments?: DealSalesAssessment[];
}

export async function getDeals(): Promise<Deal[]> {
  const res = await api.get<Deal[]>('deals');
  return res.data;
}

export async function createDeal(payload: { name: string; leadId: string; clientId?: string | null; stage?: DealStage }): Promise<Deal> {
  const res = await api.post<Deal>('deals', payload);
  return res.data;
}

export async function updateDealStage(id: string, stage: DealStage): Promise<Deal> {
  const res = await api.put<Deal>(`deals/${id}/stage`, { stage });
  return res.data;
}

export async function deleteDeal(id: string): Promise<void> {
  await api.delete(`deals/${id}`);
}

// Normalizes the pre-existing case-inconsistent stage values in the database
// (the model's raw default is lowercase "new", while the enum is title-case)
// so a deal always lands in the right Kanban column regardless of casing.
export function normalizeStage(rawStage: string): DealStage {
  const match = DEAL_STAGES.find((stage) => stage.toLowerCase() === rawStage.trim().toLowerCase());
  return match || 'New';
}
