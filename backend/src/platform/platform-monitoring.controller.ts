import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { PlatformMonitoringService } from './platform-monitoring.service';

/**
 * Cross-tenant monitoring for the platform owner: plans, credit balances, AI
 * spend and recharge history. Read-only -- the owner's write actions (granting
 * and revoking the Trial plan and comps) live in CompController, under the same
 * SuperAdminGuard.
 */
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('platform')
export class PlatformMonitoringController {
  constructor(private readonly monitoring: PlatformMonitoringService) {}

  @Get('overview')
  overview() {
    return this.monitoring.overview();
  }

  @Get('tenants')
  tenants() {
    return this.monitoring.tenants();
  }

  @Get('ai-usage')
  aiUsage(@Query('days') days?: string) {
    const parsed = Number(days);
    const window =
      Number.isInteger(parsed) && parsed > 0 && parsed <= 365
        ? parsed
        : undefined;
    return this.monitoring.aiUsageBreakdown(window);
  }

  @Get('recharges')
  recharges(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    const take = Number.isInteger(parsed) && parsed > 0 ? parsed : 50;
    return this.monitoring.recharges(take);
  }
}
