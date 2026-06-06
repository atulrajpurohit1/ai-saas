import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiExecutiveCenterService } from './ai-executive-center.service';

@Controller('ai-executive-center')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.view')
export class AiExecutiveCenterController {
  constructor(private readonly executiveCenterService: AiExecutiveCenterService) {}

  @Get()
  dashboard(@GetUser() user: ActiveUser) {
    return this.executiveCenterService.getDashboard(user.tenantId, user.sub);
  }

  @Get('summary')
  summary(@GetUser() user: ActiveUser) {
    return this.executiveCenterService.getSummary(user.tenantId, user.sub);
  }

  @Get('risks')
  risks(@GetUser() user: ActiveUser) {
    return this.executiveCenterService.getRisks(user.tenantId, user.sub);
  }

  @Get('opportunities')
  opportunities(@GetUser() user: ActiveUser) {
    return this.executiveCenterService.getOpportunities(user.tenantId, user.sub);
  }

  @Get('recommendations')
  recommendations(@GetUser() user: ActiveUser) {
    return this.executiveCenterService.getRecommendations(user.tenantId, user.sub);
  }
}
