import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiMonitoringService } from './ai-monitoring.service';

@Controller('ai-monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiMonitoringController {
  constructor(private readonly aiMonitoringService: AiMonitoringService) {}

  @Get()
  getMonitoring(@GetUser() user: ActiveUser) {
    return this.aiMonitoringService.getMonitoring(user.tenantId);
  }
}
