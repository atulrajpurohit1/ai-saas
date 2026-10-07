import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiUsageService } from './ai-usage.service';

/** Default reporting window when none is given. */
const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;

/**
 * Reads the AI usage log.
 *
 * Deliberately NOT gated on a service module the way the credits controller
 * is: AI features span every module, so the cost question is account-wide.
 *
 * `billing.manage` rather than a view permission -- this exposes our own cost
 * and margin, which is not customer-facing data.
 */
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('ai/usage')
export class AiUsageController {
  constructor(private readonly aiUsage: AiUsageService) {}

  private windowStart(days?: string): Date {
    const parsed = Number(days);
    const clamped =
      Number.isFinite(parsed) && parsed > 0
        ? Math.min(parsed, MAX_WINDOW_DAYS)
        : DEFAULT_WINDOW_DAYS;
    return new Date(Date.now() - clamped * 24 * 60 * 60 * 1000);
  }

  /**
   * Cost per feature -- the report a per-feature credit price is set from.
   * `averageCostUsd` is the price floor; `maxCostUsd` is the margin risk.
   */
  @Get('features')
  @RequirePermission('billing.manage')
  getFeatureCosts(@Query('days') days?: string) {
    return this.aiUsage.getFeatureCostSummary({ since: this.windowStart(days) });
  }

  /** What each tenant costs us -- unanswerable before this log existed. */
  @Get('tenants')
  @RequirePermission('billing.manage')
  getTenantCosts(@Query('days') days?: string, @Query('limit') limit?: string) {
    const parsedLimit = Number(limit);
    return this.aiUsage.getTopTenantsByCost({
      since: this.windowStart(days),
      limit:
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(parsedLimit, 100)
          : undefined,
    });
  }

  /** The caller's own tenant: feature breakdown plus total spend. */
  @Get('mine')
  @RequirePermission('billing.manage')
  async getOwnUsage(
    @GetUser() user: ActiveUser,
    @Query('days') days?: string,
  ) {
    const since = this.windowStart(days);
    const [features, totalCostUsd] = await Promise.all([
      this.aiUsage.getFeatureCostSummary({ since, tenantId: user.tenantId }),
      this.aiUsage.getTenantCostUsd(user.tenantId, since),
    ]);
    return { since, totalCostUsd, features };
  }
}
