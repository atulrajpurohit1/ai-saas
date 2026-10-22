import platformApi from '@/lib/platform-api';

/**
 * Platform-owner API: cross-tenant monitoring, tenant lifecycle, and granting
 * or revoking the AegisLead Trial plan.
 *
 * Every call goes through platformApi, which sends the platform session token
 * and never a tenant one. Server-side, every endpoint is behind
 * PlatformAdminGuard and a separately-signed token, so a tenant admin calling
 * these URLs directly -- with any role, any flags -- gets a 401.
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
  /**
   * Granted, but queued behind a paid subscription and not started yet. Such a
   * row is never `active`: the tenant is still on the plan they are paying for.
   */
  scheduled?: boolean;
  /** When a queued grant starts. Null means "when the paid plan ends". */
  startsAt?: string | null;
  /** How long a queued grant runs for, counted from when it starts. */
  days?: number | null;
  reason: string | null;
  grantedBy: string | null;
  updatedAt: string;
}

export async function listComps(): Promise<CompRow[]> {
  const res = await platformApi.get<CompRow[]>('platform/comps');
  return res.data;
}

export async function grantComp(input: {
  tenantId: string;
  package: CompPlanKey;
  /** Omit for lifetime (open-ended) access. */
  expiresInDays?: number;
  reason: string;
}): Promise<{
  tenantId: string;
  package: CompPlanKey;
  aiEnabled: boolean;
  expiresAt: string | null;
  /**
   * True when the tenant was inside a paid period, so the grant was queued
   * instead of applied. The server decides this -- comping over a live paid
   * plan immediately is not offered, because it would downgrade a customer who
   * has already been charged.
   */
  scheduled?: boolean;
  startsAt?: string | null;
}> {
  const res = await platformApi.post('platform/comps/grant', input);
  return res.data;
}

export async function revokeComp(input: {
  tenantId: string;
  reason?: string;
}): Promise<{ tenantId: string; wasScheduled?: boolean }> {
  const res = await platformApi.post('platform/comps/revoke', input);
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
  const res = await platformApi.get<PlatformOverview>('platform/overview');
  return res.data;
}

export interface PlatformTenant {
  tenantId: string;
  name: string;
  createdAt: string;
  slug: string;
  /** False once a platform admin has suspended the account. */
  isActive: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  userCount: number;
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
  const res = await platformApi.get<PlatformTenant[]>('platform/tenants');
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
  const res = await platformApi.get<AiUsageBreakdown>('platform/ai-usage', {
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
  const res = await platformApi.get<RechargeAttempt[]>('platform/recharges', {
    params: { limit },
  });
  return res.data;
}

// --- Tenant lifecycle ----------------------------------------------------

export interface CreateTenantInput {
  name: string;
  ownerEmail: string;
  ownerName?: string;
  /** Twelve characters minimum; the server enforces the same floor. */
  ownerPassword: string;
}

export interface CreatedTenant {
  tenantId: string;
  name: string;
  slug: string;
  ownerEmail: string;
}

/**
 * Creates a tenant and its first owner account. The owner is an ordinary
 * tenant user -- full rights inside their own tenant, none over the platform.
 */
export async function createTenant(
  input: CreateTenantInput,
): Promise<CreatedTenant> {
  const res = await platformApi.post('platform/tenants', input);
  return res.data;
}

/**
 * Reversible: blocks every login for the tenant (agency, client portal and
 * guard app alike) and revokes live sessions, while keeping all of its data.
 */
export async function suspendTenant(input: {
  tenantId: string;
  reason?: string;
}): Promise<{ tenantId: string; isActive: boolean }> {
  const res = await platformApi.post(
    `platform/tenants/${input.tenantId}/suspend`,
    { reason: input.reason },
  );
  return res.data;
}

export async function reactivateTenant(
  tenantId: string,
): Promise<{ tenantId: string; isActive: boolean }> {
  const res = await platformApi.post(
    `platform/tenants/${tenantId}/reactivate`,
    {},
  );
  return res.data;
}

/**
 * PERMANENT. Cascades to every row the tenant owns -- users, leads, invoices,
 * shifts, incidents, evidence, credits.
 *
 * `confirmName` must equal the tenant's exact name. The server checks it, so
 * the confirmation is a real precondition rather than a dialog that a direct
 * API call could skip.
 */
export async function deleteTenant(input: {
  tenantId: string;
  confirmName: string;
}): Promise<{ tenantId: string; deleted: boolean; name: string }> {
  const res = await platformApi.delete(
    `platform/tenants/${input.tenantId}`,
    { data: { confirmName: input.confirmName } },
  );
  return res.data;
}

// --- helpers -------------------------------------------------------------

/** Whole days remaining until `expiresAt`, or null for lifetime access. */
export function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
