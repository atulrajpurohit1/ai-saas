import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiInsightsService } from './ai-insights.service';

@Controller('ai-insights')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiInsightsController {
  constructor(private readonly aiInsightsService: AiInsightsService) {}

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
}
