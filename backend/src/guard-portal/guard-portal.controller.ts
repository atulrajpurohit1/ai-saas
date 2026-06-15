import { Body, Controller, Get, Param, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GuardPortalService } from './guard-portal.service';
import { SyncOfflineActionsDto } from './dto/sync-offline-actions.dto';

@Controller('guard')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  shifts(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.getAssignedShifts(tenantId, guardId);
  }

  @Get('shifts/:id')
  shiftDetail(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.getShiftDetail(tenantId, guardId, id);
  }

  @Post('shifts/:id/check-in')
  checkIn(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.checkIn(tenantId, guardId, id);
  }

  @Post('shifts/:id/check-out')
  checkOut(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.checkOut(tenantId, guardId, id);
  }

  @Post('sync')
  syncOfflineActions(@GetUser() user: ActiveUser, @Body() dto: SyncOfflineActionsDto) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.processSyncQueue(tenantId, guardId, dto);
  }

  @Get('sync/status')
  syncStatus(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.guardPortalService.getSyncStatus(tenantId, guardId);
  }
}
