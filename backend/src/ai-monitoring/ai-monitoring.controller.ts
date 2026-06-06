import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiMonitoringService } from './ai-monitoring.service';

@Controller('ai-monitoring')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.manage')
export class AiMonitoringController {
  constructor(private readonly aiMonitoringService: AiMonitoringService) {}

  @Get()
  getMonitoring(@GetUser() user: ActiveUser) {
    return this.aiMonitoringService.getMonitoring(user.tenantId);
  }
}
