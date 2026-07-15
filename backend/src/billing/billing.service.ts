import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type PlanKey = 'free' | 'starter' | 'growth' | 'enterprise';
type LimitKey = 'adminUsers' | 'clientUsers' | 'branches' | 'leads' | 'deals';

type PlanLimits = Record<LimitKey, number | null>;

const PLANS: Record<PlanKey, { name: string; monthlyPrice: number | null; limits: PlanLimits }> = {
  free: {
    name: 'Free',
    monthlyPrice: 0,
    limits: { adminUsers: 2, clientUsers: 3, branches: 1, leads: 25, deals: 10 },
  },
  starter: {
    name: 'Starter',
    monthlyPrice: 99,
    limits: { adminUsers: 5, clientUsers: 25, branches: 3, leads: 500, deals: 150 },
  },
  growth: {
    name: 'Growth',
    monthlyPrice: 299,
    limits: { adminUsers: 20, clientUsers: 100, branches: 20, leads: 5000, deals: 1500 },
  },
  enterprise: {
    name: 'Enterprise',
    monthlyPrice: null,
    limits: { adminUsers: null, clientUsers: null, branches: null, leads: null, deals: null },
  },
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantBilling(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, createdAt: true },
    });
    const planKey = this.planKeyForTenant(tenant?.slug);
    const plan = PLANS[planKey];
    const usage = await this.usage(tenantId);
    const limits = Object.entries(plan.limits).reduce<Record<string, any>>(
      (acc, [key, limit]) => {
        const used = usage[key as LimitKey];
        acc[key] = {
          used,
          limit,
          remaining: limit === null ? null : Math.max(0, limit - used),
          percent: limit === null ? null : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100)),
          exceeded: limit !== null && used > limit,
        };
        return acc;
      },
      {},
    );

    return {
      tenant,
      plan: {
        key: planKey,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        source: this.planSource(tenant?.slug),
      },
      limits,
      features: this.featuresForPlan(planKey),
      availablePlans: Object.entries(PLANS).map(([key, value]) => ({
        key,
        name: value.name,
        monthlyPrice: value.monthlyPrice,
        limits: value.limits,
      })),
    };
  }

  async assertCanAddAdminUser(tenantId: string) {
    await this.assertWithinLimit(tenantId, 'adminUsers', 'admin users');
  }

  async assertCanAddClientUser(tenantId: string) {
    await this.assertWithinLimit(tenantId, 'clientUsers', 'client portal users');
  }

  private async assertWithinLimit(tenantId: string, key: LimitKey, label: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    const plan = PLANS[this.planKeyForTenant(tenant?.slug)];
    const limit = plan.limits[key];
    if (limit === null) return;

    const usage = await this.usage(tenantId);
    if (usage[key] >= limit) {
      throw new ForbiddenException(
        `Plan limit reached for ${label}. Upgrade the billing plan or remove inactive users.`,
      );
    }
  }

  private async usage(tenantId: string): Promise<Record<LimitKey, number>> {
    const [adminUsers, clientUsers, branches, leads, deals] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.clientUser.count({ where: { tenantId } }),
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.deal.count({ where: { tenantId } }),
    ]);

    return { adminUsers, clientUsers, branches, leads, deals };
  }

  private planKeyForTenant(slug?: string | null): PlanKey {
    const tenantOverride = slug
      ? process.env[`BILLING_PLAN_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`]
      : undefined;
    const candidate = (tenantOverride || process.env.BILLING_DEFAULT_PLAN || 'starter').toLowerCase();
    return this.isPlanKey(candidate) ? candidate : 'starter';
  }

  private planSource(slug?: string | null) {
    if (!slug) return 'default';
    const key = `BILLING_PLAN_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    return process.env[key] ? key : 'BILLING_DEFAULT_PLAN';
  }

  private isPlanKey(value: string): value is PlanKey {
    return value === 'free' || value === 'starter' || value === 'growth' || value === 'enterprise';
  }

  private featuresForPlan(plan: PlanKey) {
    return {
      salesAccelerator: true,
      salesAutomation: plan !== 'free',
      publicApi: plan === 'growth' || plan === 'enterprise',
      customDomains: plan === 'growth' || plan === 'enterprise',
      prioritySupport: plan === 'enterprise',
    };
  }
}
