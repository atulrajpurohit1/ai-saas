import { Controller, Get, Post, Put, Body, Param, UseGuards, Query } from '@nestjs/common';
import { PatrolsService } from './patrols.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission, RequireAnyPermission } from '../auth/decorators/permissions.decorator';
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
  findPatrolRoute(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
  ) {
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
  findAllPatrolRuns(@GetUser() user: ActiveUser) {
    return this.patrolsService.findAllPatrolRuns(user);
  }

  @Get('patrol-runs/:id')
  @RequireAnyPermission('patrols.view', 'patrols.manage')
  findPatrolRun(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
  ) {
    return this.patrolsService.findPatrolRun(user, id);
  }
}
