import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SalesAutomationService } from './sales-automation.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('sales-automation')
export class SalesAutomationController {
  constructor(private readonly salesAutomationService: SalesAutomationService) {}

  @Get('status')
  @RequireAnyPermission('ai.view', 'deals.view', 'activities.view')
  status() {
    return this.salesAutomationService.getStatus();
  }

  @Post('run')
  @RequireAnyPermission('activities.manage', 'deals.update', 'ai.manage')
  run(@GetUser() user: ActiveUser) {
    return this.salesAutomationService.runForTenant(user.tenantId, user.sub);
  }
}
