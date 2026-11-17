import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { PlanGuard } from '../auth/guards/plan.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ConnectRingCentralDto } from './dto/connect-ringcentral.dto';
import { DialDto } from './dto/dial.dto';
import { RingCentralConnectionService } from './ringcentral-connection.service';
import { RingCentralDialService } from './ringcentral-dial.service';

/**
 * Tenant-facing RingCentral administration.
 *
 * Gated on LEAD_GEN at class level: connecting a phone system exists to feed
 * the call log, which is a LEAD_GEN surface. Without this an account that had
 * bought nothing could still wire up telephony and populate CallRecord -- the
 * same side door the CRM import route had to be closed against.
 */
@UseGuards(JwtAuthGuard, PlanGuard, PermissionGuard, ModuleGuard)
@Controller('ringcentral')
@RequireModule('LEAD_GEN')
export class RingCentralController {
  constructor(
    private readonly connections: RingCentralConnectionService,
    private readonly dialService: RingCentralDialService,
  ) {}

  @Get('status')
  @RequireAnyPermission('integrations.view', 'calls.view')
  getStatus(@GetUser() user: ActiveUser) {
    return this.connections.getStatus(user);
  }

  @Post('connect')
  @RequirePermission('integrations.manage')
  connect(@GetUser() user: ActiveUser, @Body() dto: ConnectRingCentralDto) {
    return this.connections.connect(user, dto);
  }

  @Delete('connect')
  @RequirePermission('integrations.manage')
  disconnect(@GetUser() user: ActiveUser) {
    return this.connections.disconnect(user);
  }

  /**
   * Click-to-call. Gated on calls.create, the same permission that governs
   * dialling through the tel: link -- placing a call is the same act however
   * the dialler is reached.
   */
  @Post('dial')
  @RequirePermission('calls.create')
  dial(@GetUser() user: ActiveUser, @Body() dto: DialDto) {
    return this.dialService.dial(user, dto);
  }
}
