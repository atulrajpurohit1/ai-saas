import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { PatrolsService } from './patrols.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import {
  RequirePermission,
  RequireAnyPermission,
} from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { CreatePatrolRouteDto } from './dto/create-patrol-route.dto';
import { UpdatePatrolRouteDto } from './dto/update-patrol-route.dto';
import { AttachCheckpointsDto } from './dto/attach-checkpoints.dto';

@Controller('')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PatrolsController {
  constructor(private readonly patrolsService: PatrolsService) {}

  @Post('checkpoints')
  @RequirePermission('patrols.manage')
  createCheckpoint(
    @GetUser() user: ActiveUser,
    @Body() dto: CreateCheckpointDto,
  ) {
    return this.patrolsService.createCheckpoint(user, dto);
  }

  @Get('checkpoints')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  findAllCheckpoints(
    @GetUser() user: ActiveUser,
    @Query('site_id') siteId?: string,
  ) {
    return this.patrolsService.findAllCheckpoints(user, siteId);
  }

  @Put('checkpoints/:id')
  @RequirePermission('patrols.manage')
  updateCheckpoint(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateCheckpointDto,
  ) {
    return this.patrolsService.updateCheckpoint(user, id, dto);
  }

  @Post('patrol-routes')
  @RequirePermission('patrols.manage')
  createPatrolRoute(
    @GetUser() user: ActiveUser,
    @Body() dto: CreatePatrolRouteDto,
  ) {
    return this.patrolsService.createPatrolRoute(user, dto);
  }

  @Get('patrol-routes')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  findAllPatrolRoutes(
    @GetUser() user: ActiveUser,
    @Query('site_id') siteId?: string,
  ) {
    return this.patrolsService.findAllPatrolRoutes(user, siteId);
  }

  @Get('patrol-routes/:id')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  findPatrolRoute(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.patrolsService.findPatrolRoute(user, id);
  }

  @Put('patrol-routes/:id')
  @RequirePermission('patrols.manage')
  updatePatrolRoute(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdatePatrolRouteDto,
  ) {
    return this.patrolsService.updatePatrolRoute(user, id, dto);
  }

  @Post('patrol-routes/:id/checkpoints')
  @RequirePermission('patrols.manage')
  attachCheckpoints(
    @GetUser() user: ActiveUser,
    @Param('id') routeId: string,
    @Body() dto: AttachCheckpointsDto,
  ) {
    return this.patrolsService.attachCheckpoints(user, routeId, dto);
  }

  @Get('patrol-runs')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  findAllPatrolRuns(
    @GetUser() user: ActiveUser,
    @Query('status') status?: string,
  ) {
    return this.patrolsService.findAllPatrolRuns(user, status);
  }

  // Must be declared before 'patrol-runs/:id' so ":id" never captures "overview".
  @Get('patrol-runs/overview')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  getPatrolOverview(@GetUser() user: ActiveUser) {
    return this.patrolsService.getPatrolOverview(user);
  }

  @Get('patrol-runs/:id')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  findPatrolRun(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.patrolsService.findPatrolRun(user, id);
  }

  // --- Phase 3H: checkpoint photo evidence (read-only for admin/dispatcher) ---
  // Authorized patrol viewers may list and stream the photos a guard
  // attached to a checkpoint scan. Tenant + branch scoping is identical to
  // every other admin patrol-run read; there is no admin write surface -
  // evidence is created only by the guard who performed the scan.

  @Get('patrol-runs/:id/events/:eventId/evidence')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  listCheckpointEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.patrolsService.listCheckpointEvidenceForAdmin(
      user,
      runId,
      eventId,
    );
  }

  @Get('patrol-runs/:id/events/:eventId/evidence/:evidenceId/file')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  async downloadCheckpointEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
    @Param('eventId') eventId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const { stream, mimeType, fileName, fileSizeBytes } =
      await this.patrolsService.getCheckpointEvidenceFileForAdmin(
        user,
        runId,
        eventId,
        evidenceId,
      );

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Length': String(fileSizeBytes),
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, no-store',
    });
    stream.pipe(res);
  }
}
