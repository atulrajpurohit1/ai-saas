import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GuardPortalService } from './guard-portal.service';
import { SyncOfflineActionsDto } from './dto/sync-offline-actions.dto';

/**
 * The guard app authenticates with a guard token rather than a staff JWT, so
 * it never passed through ModuleGuard. Shift attendance is the Guard Tour
 * product: a tenant could cancel Guard Tour and their guards would keep
 * checking in and out through this app forever, while the web app correctly
 * locked their own staff out.
 *
 * Gated on GUARD_TOUR *or* FINANCE because the guard app spans both -- shifts
 * are rostered under Operations, attendance is executed under Guard -- and a
 * tenant who bought either one legitimately runs the app. A tenant with
 * neither cannot have guards to begin with.
 *
 * GET /guard/me is deliberately left open: it is the guard's own profile and
 * the first call the app makes after login, so gating it would surface a
 * lapsed plan as a broken login rather than a locked feature.
 */
@Controller('guard')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('guard')
export class GuardPortalController {
  constructor(private readonly guardPortalService: GuardPortalService) {}

  private getGuardContext(user: ActiveUser) {
    if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
      throw new ForbiddenException('Guard access required');
    }

    return {
      tenantId: user.tenantId,
      guardId: user.guardId,
    };
  }

  @Get('me')
  me(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.getProfile(tenantId, guardId);
  }

  @Get('shifts')
  @RequireModule('GUARD_TOUR', 'FINANCE')
  shifts(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.getAssignedShifts(tenantId, guardId);
  }

  @Get('shifts/:id')
  @RequireModule('GUARD_TOUR', 'FINANCE')
  shiftDetail(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.getShiftDetail(tenantId, guardId, id);
  }

  @Post('shifts/:id/check-in')
  @RequireModule('GUARD_TOUR', 'FINANCE')
  checkIn(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.checkIn(tenantId, guardId, id);
  }

  @Post('shifts/:id/check-out')
  @RequireModule('GUARD_TOUR', 'FINANCE')
  checkOut(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.checkOut(tenantId, guardId, id);
  }

  @Post('sync')
  @RequireModule('GUARD_TOUR', 'FINANCE')
  syncOfflineActions(
    @GetUser() user: ActiveUser,
    @Body() dto: SyncOfflineActionsDto,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.processSyncQueue(tenantId, guardId, dto);
  }

  @Get('sync/status')
  @RequireModule('GUARD_TOUR', 'FINANCE')
  syncStatus(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.getSyncStatus(tenantId, guardId);
  }
}
