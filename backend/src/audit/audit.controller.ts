import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('audit.view')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.auditService.findAll(user.tenantId);
  }
}
