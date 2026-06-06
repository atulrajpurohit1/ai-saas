import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiInsightsService } from './ai-insights.service';
import { RevenueInsightsService } from './revenue-insights.service';

@Controller('ai-insights')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.view')
export class AiInsightsController {
  constructor(
    private readonly aiInsightsService: AiInsightsService,
    private readonly revenueInsightsService: RevenueInsightsService,
  ) {}

  @Get()
  dashboard(@GetUser() user: ActiveUser) {
    return this.aiInsightsService.getDashboard(user.tenantId, user.sub);
  }

  @Get('clients')
  clients(@GetUser() user: ActiveUser) {
    return this.aiInsightsService.getClientInsights(user.tenantId);
  }

  @Get('guards')
  guards(@GetUser() user: ActiveUser) {
    return this.aiInsightsService.getGuardInsights(user.tenantId);
  }

  @Get('sites')
  sites(@GetUser() user: ActiveUser) {
    return this.aiInsightsService.getSiteInsights(user.tenantId);
  }

  @Get('billing')
  billing(@GetUser() user: ActiveUser) {
    return this.aiInsightsService.getBillingInsights(user.tenantId);
  }

  @Get('incidents')
  @RequirePermission('incidents.view')
  incidents(@GetUser() user: ActiveUser) {
    return this.aiInsightsService.getIncidentInsights(user.tenantId, user.sub);
  }

  @Get('revenue')
  @RequirePermission('finance.view')
  revenue(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getRevenueDashboard(
      user.tenantId,
      user.sub,
    );
  }

  @Get('contracts')
  @RequirePermission('finance.view')
  contracts(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getContractInsights(
      user.tenantId,
      user.sub,
    );
  }

  @Get('client-value')
  @RequirePermission('finance.view')
  clientValue(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getClientValueAnalysis(
      user.tenantId,
      user.sub,
    );
  }

  @Get('renewals')
  @RequirePermission('finance.view')
  renewals(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getRenewalOpportunities(
      user.tenantId,
      user.sub,
    );
  }

  @Get('recommendations')
  @RequirePermission('finance.view')
  recommendations(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getFinancialRecommendations(
      user.tenantId,
      user.sub,
    );
  }
}
