import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @RequirePermission('sessions.view')
  list(@GetUser() user: ActiveUser) {
    return this.sessionsService.list(user);
  }

  @Delete(':id')
  @RequirePermission('sessions.manage')
  revoke(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.sessionsService.revoke(user, id);
  }
}
