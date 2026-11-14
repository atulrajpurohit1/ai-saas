import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../auth/guards/plan.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PlanGuard, PermissionGuard)
@RequirePermission('dashboard.view')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@GetUser() user: ActiveUser) {
    return this.dashboardService.getSummary(user.tenantId);
  }

  @Get('recent-activity')
  getRecentActivity(@GetUser() user: ActiveUser) {
    return this.dashboardService.getRecentActivity(user.tenantId);
  }
}
