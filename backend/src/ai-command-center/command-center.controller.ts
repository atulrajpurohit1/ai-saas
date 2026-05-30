import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CommandCenterService } from './command-center.service';

@Controller('ai-command-center')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'finance')
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  @Get()
  getDashboard(@GetUser() user: ActiveUser) {
    return this.commandCenterService.getDashboard(user.tenantId, user.sub);
  }

  @Get('summary')
  getSummary(@GetUser() user: ActiveUser) {
    return this.commandCenterService.getSummary(user.tenantId, user.sub);
  }

  @Get('recommendations')
  getRecommendations(@GetUser() user: ActiveUser) {
    return this.commandCenterService.getRecommendations(user.tenantId, user.sub);
  }

  @Get('risks')
  getRisks(@GetUser() user: ActiveUser) {
    return this.commandCenterService.getRisks(user.tenantId, user.sub);
  }
}
