import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';

@Controller('guard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('guard')
export class GuardIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  private getGuardContext(user: ActiveUser) {
    if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
      throw new ForbiddenException('Guard access required');
    }

    return {
      tenantId: user.tenantId,
      guardId: user.guardId,
    };
  }

  @Post('shifts/:id/incidents')
  createForShift(
    @GetUser() user: ActiveUser,
    @Param('id') shiftId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.incidentsService.createForGuard(tenantId, guardId, shiftId, dto);
  }

  @Get('incidents')
  findMine(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.incidentsService.findForGuard(tenantId, guardId);
  }
}
