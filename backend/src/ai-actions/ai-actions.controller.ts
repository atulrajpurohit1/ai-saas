import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AiActionsService } from './ai-actions.service';

@Controller('ai-actions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.manage')
export class AiActionsController {
  constructor(private readonly aiActionsService: AiActionsService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('status') status?: string) {
    return this.aiActionsService.findAll(user.tenantId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: ActiveUser) {
    return this.aiActionsService.findOne(id, user.tenantId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @GetUser() user: ActiveUser) {
    return this.aiActionsService.approve(id, user.tenantId, user.sub);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @GetUser() user: ActiveUser) {
    return this.aiActionsService.reject(id, user.tenantId, user.sub);
  }

  @Post(':id/execute')
  execute(@Param('id') id: string, @GetUser() user: ActiveUser) {
    return this.aiActionsService.execute(id, user.tenantId, user.sub);
  }
}
