import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { EmergencyAlertsService } from './emergency-alerts.service';

// Guard-facing. Mirrors GuardPatrolsController/GuardIncidentsController
// exactly: gated by role (not the permission system, which guards don't
// participate in), with guard identity and tenant always taken from the
// JWT - never from the request body.
@Controller('guard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('guard')
export class GuardEmergencyAlertsController {
  constructor(
    private readonly emergencyAlertsService: EmergencyAlertsService,
  ) {}

  private getGuardContext(user: ActiveUser) {
    if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
      throw new ForbiddenException('Guard access required');
    }

    return {
      tenantId: user.tenantId,
      guardId: user.guardId,
    };
  }

  @Post('emergency-alerts')
  trigger(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.emergencyAlertsService.triggerForGuard(tenantId, guardId);
  }

  @Get('emergency-alerts/active')
  active(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.emergencyAlertsService.findActiveForGuard(tenantId, guardId);
  }
}
