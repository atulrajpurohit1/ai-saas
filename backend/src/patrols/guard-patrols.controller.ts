import { Controller, Get, Post, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { PatrolsService } from './patrols.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { StartPatrolRunDto } from './dto/start-patrol-run.dto';
import { ScanCheckpointDto } from './dto/scan-checkpoint.dto';

@Controller('guard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('guard')
export class GuardPatrolsController {
  constructor(private readonly patrolsService: PatrolsService) {}

  private getGuardContext(user: ActiveUser) {
    if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
      throw new ForbiddenException('Guard access required');
    }

    return {
      tenantId: user.tenantId,
      guardId: user.guardId,
    };
  }

  @Get('shifts/:id/patrol-routes')
  getShiftPatrolRoutes(
    @GetUser() user: ActiveUser,
    @Param('id') shiftId: string,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.getShiftPatrolRoutes(tenantId, guardId, shiftId);
  }

  @Post('shifts/:id/patrol-runs/start')
  startPatrolRun(
    @GetUser() user: ActiveUser,
    @Param('id') shiftId: string,
    @Body() dto: StartPatrolRunDto,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.startPatrolRun(tenantId, guardId, shiftId, dto);
  }

  @Post('patrol-runs/:id/checkpoints/:checkpointId/scan')
  scanCheckpoint(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
    @Param('checkpointId') checkpointId: string,
    @Body() dto: ScanCheckpointDto,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.scanCheckpoint(tenantId, guardId, runId, checkpointId, dto);
  }

  @Post('patrol-runs/:id/complete')
  completePatrolRun(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.completePatrolRun(tenantId, guardId, runId);
  }

  @Get('patrol-runs')
  getGuardPatrolRuns(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.getGuardPatrolRuns(tenantId, guardId);
  }
}
