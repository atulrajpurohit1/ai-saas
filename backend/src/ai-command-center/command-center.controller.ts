import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CommandCenterService } from './command-center.service';

@Controller('ai-command-center')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.view')
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  @Get()
  getDashboard(@GetUser() user: ActiveUser) {
    return this.commandCenterService.getDashboard(
      user.tenantId,
      user.sub,
      user.role,
    );
  }

  @Get('summary')
  getSummary(@GetUser() user: ActiveUser) {
    return this.commandCenterService.getSummary(
      user.tenantId,
      user.sub,
      user.role,
    );
  }

  @Get('recommendations')
  getRecommendations(@GetUser() user: ActiveUser) {
    return this.commandCenterService.getRecommendations(
      user.tenantId,
      user.sub,
      user.role,
    );
  }

  @Get('risks')
  getRisks(@GetUser() user: ActiveUser) {
    return this.commandCenterService.getRisks(user.tenantId, user.sub);
  }
}
