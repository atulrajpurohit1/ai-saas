import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiInsightsService } from './ai-insights.service';
import { RevenueInsightsService } from './revenue-insights.service';

@Controller('ai-insights')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiInsightsController {
  constructor(
    private readonly aiInsightsService: AiInsightsService,
    private readonly revenueInsightsService: RevenueInsightsService,
  ) {}

  @Get()
  dashboard(@GetUser() user: ActiveUser) {
    return this.aiInsightsService.getDashboard(user.tenantId);
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
  @Roles('admin', 'supervisor')
  incidents(@GetUser() user: ActiveUser) {
    return this.aiInsightsService.getIncidentInsights(user.tenantId);
  }

  @Get('revenue')
  @Roles('admin', 'finance')
  revenue(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getRevenueDashboard(
      user.tenantId,
      user.sub,
    );
  }

  @Get('contracts')
  @Roles('admin', 'finance')
  contracts(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getContractInsights(
      user.tenantId,
      user.sub,
    );
  }

  @Get('client-value')
  @Roles('admin', 'finance')
  clientValue(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getClientValueAnalysis(
      user.tenantId,
      user.sub,
    );
  }

  @Get('renewals')
  @Roles('admin', 'finance')
  renewals(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getRenewalOpportunities(
      user.tenantId,
      user.sub,
    );
  }

  @Get('recommendations')
  @Roles('admin', 'finance')
  recommendations(@GetUser() user: ActiveUser) {
    return this.revenueInsightsService.getFinancialRecommendations(
      user.tenantId,
      user.sub,
    );
  }
}
