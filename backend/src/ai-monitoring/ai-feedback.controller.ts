import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiMonitoringService } from './ai-monitoring.service';
import { CreateAiFeedbackDto } from './dto/create-ai-feedback.dto';

@Controller('ai-feedback')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.manage')
export class AiFeedbackController {
  constructor(private readonly aiMonitoringService: AiMonitoringService) {}

  @Post()
  create(@GetUser() user: ActiveUser, @Body() dto: CreateAiFeedbackDto) {
    return this.aiMonitoringService.createFeedback(
      user.tenantId,
      user.sub,
      dto,
    );
  }

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.aiMonitoringService.findFeedback(user.tenantId);
  }
}
