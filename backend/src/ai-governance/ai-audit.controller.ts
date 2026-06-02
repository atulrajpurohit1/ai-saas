import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiGovernanceService } from './ai-governance.service';

@Controller('ai-audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiAuditController {
  constructor(private readonly aiGovernanceService: AiGovernanceService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.aiGovernanceService.findAudit(user.tenantId);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.aiGovernanceService.findAuditById(id, user.tenantId);
  }

  @Post(':id/approve')
  approve(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.aiGovernanceService.approveGeneration(
      id,
      user.tenantId,
      user.sub,
    );
  }
}
