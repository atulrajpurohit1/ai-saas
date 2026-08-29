import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PatrolsService } from './patrols.service';

// Phase 3E: client-facing "guard on site now" status. Mirrors
// ClientIncidentsController/ClientReportsController exactly - role-gated
// (not the permission system, which clients don't participate in), with
// clientId/tenantId always taken from the JWT.
@Controller('client/patrols')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('client')
export class ClientPatrolsController {
  constructor(private readonly patrolsService: PatrolsService) {}

  private getClientContext(user: ActiveUser) {
    if (user.role !== 'client' || !user.clientId || !user.tenantId) {
      throw new ForbiddenException('Client access required');
    }

    return {
      tenantId: user.tenantId,
      clientId: user.clientId,
    };
  }

  @Get('live-status')
  liveStatus(@GetUser() user: ActiveUser) {
    const { tenantId, clientId } = this.getClientContext(user);
    return this.patrolsService.getLiveSiteStatusForClient(tenantId, clientId);
  }
}
