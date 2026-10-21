import api from '@/lib/api';

/**
 * Platform-owner (super admin) API: cross-tenant monitoring plus granting and
 * revoking the AegisLead Trial plan. Every call here is gated server-side by
 * SuperAdminGuard, so a normal tenant admin cannot reach it even if they call
 * the endpoints directly.
 */

// --- Comp / Trial plans the owner can grant ------------------------------

/** The plans a comp can grant. TRIAL is the non-AI "AegisLead Trial Plan". */
export type CompPlanKey =
  | 'TRIAL'
  | 'GENERATION'
  | 'GUARD'
  | 'OPERATIONS'
  | 'COMPLETE';

export const COMP_PLAN_LABELS: Record<CompPlanKey, string> = {
  TRIAL: 'AegisLead Trial Plan',
  GENERATION: 'AegisLead Generation',
  GUARD: 'AegisLead Guard',
  OPERATIONS: 'AegisLead Operations',
  COMPLETE: 'AegisLead Complete',
};

export interface CompRow {
  tenantId: string;
  tenantName: string | null;
  active: boolean;
  status: string;
  aiEnabled: boolean;
  /** 'TRIAL' when AI is off, otherwise 'COMP'. */
  plan: 'TRIAL' | 'COMP';
  expiresAt: string | null;
  reason: string | null;
  grantedBy: string | null;
  updatedAt: string;
}

export async function listComps(): Promise<CompRow[]> {
  const res = await api.get<CompRow[]>('platform/comps');
  return res.data;
}

export async function grantComp(input: {
  tenantId: string;
  package: CompPlanKey;
  /** Omit for lifetime (open-ended) access. */
  expiresInDays?: number;
  reason: string;
}): Promise<{ tenantId: string; package: CompPlanKey; aiEnabled: boolean; expiresAt: string | null }> {
  const res = await api.post('platform/comps/grant', input);
  return res.data;
}

export async function revokeComp(input: {
  tenantId: string;
  reason?: string;
}): Promise<{ tenantId: string }> {
  const res = await api.post('platform/comps/revoke', input);
  return res.data;
}

// --- Monitoring ----------------------------------------------------------

export interface PlatformOverview {
  tenants: number;
  subscriptions: { paying: number; trial: number; compedPaid: number };
  creditsOutstanding: number;
  ai: { windowDays: number; costUsd: number; calls: number };
}

export async function getOverview(): Promise<PlatformOverview> {
  const res = await api.get<PlatformOverview>('platform/overview');
  return res.data;
}

export interface PlatformTenant {
  tenantId: string;
  name: string;
  createdAt: string;
  status: string | null;
  source: string | null;
  /** 'NONE' | 'TRIAL' | 'COMP' | 'STRIPE' | 'COMP' */
  plan: string;
  aiEnabled: boolean;
  compExpiresAt: string | null;
  compReason: string | null;
  creditBalance: number;
  creditsConsumed: number;
  aiCostUsd30d: number;
}

export async function getTenants(): Promise<PlatformTenant[]> {
  const res = await api.get<PlatformTenant[]>('platform/tenants');
  return res.data;
}

export interface AiFeatureCost {
  feature: string;
  calls: number;
  failedCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  averageCostUsd: number | null;
  maxCostUsd: number | null;
}

export interface AiUsageBreakdown {
  windowDays: number;
  byFeature: AiFeatureCost[];
  topTenants: { tenantId: string | null; name: string; costUsd: number; calls: number }[];
}

export async function getAiUsage(days?: number): Promise<AiUsageBreakdown> {
  const res = await api.get<AiUsageBreakdown>('platform/ai-usage', {
    params: days ? { days } : undefined,
  });
  return res.data;
}

export interface RechargeAttempt {
  id: string;
  tenantId: string;
  tenantName: string | null;
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  packKey: string;
  amountCharged: number | null;
  creditsGranted: number | null;
  balanceAtTrigger: number;
  failureReason: string | null;
  createdAt: string;
}

export async function getRecharges(limit = 50): Promise<RechargeAttempt[]> {
  const res = await api.get<RechargeAttempt[]>('platform/recharges', {
    params: { limit },
  });
  return res.data;
}

// --- helpers -------------------------------------------------------------

/** Whole days remaining until `expiresAt`, or null for lifetime access. */
export function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
