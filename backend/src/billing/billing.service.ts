import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

type UsageKey = 'adminUsers' | 'clientUsers' | 'branches' | 'leads' | 'deals';

/**
 * Tenant usage figures for the billing page.
 *
 * There used to be a second pricing system here -- Free / Starter / Growth /
 * Enterprise tiers, each with hard caps on users, branches, leads and deals.
 * It predated the package-and-guard-band pricing at /settings/plan and was
 * never removed, so the app shipped two contradictory answers to "what plan am
 * I on".
 *
 * Worse, the tier was not derived from anything the customer had bought: it
 * came from the BILLING_DEFAULT_PLAN env var, which was unset, so every tenant
 * silently fell back to 'starter' and its 5-admin-user cap -- including
 * accounts paying for Complete. Those caps were enforced, so a paying customer
 * could be blocked from adding a user by a plan they had never purchased.
 *
 * AegisLead has ONE pricing model, in pricing.constants.ts. This service now
 * reports usage only; it does not gate anything.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getTenantBilling(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, createdAt: true },
    });
    const usage = await this.usage(tenantId);

    return {
      tenant,
      usage,
      entitlements: await this.entitlements.summaryForTenant(tenantId),
    };
  }

  private async usage(tenantId: string): Promise<Record<UsageKey, number>> {
    const [adminUsers, clientUsers, branches, leads, deals] = await Promise.all(
      [
        this.prisma.user.count({ where: { tenantId } }),
        this.prisma.clientUser.count({ where: { tenantId } }),
        this.prisma.branch.count({ where: { tenantId } }),
        this.prisma.lead.count({ where: { tenantId } }),
        this.prisma.deal.count({ where: { tenantId } }),
      ],
    );

    return { adminUsers, clientUsers, branches, leads, deals };
  }
}
