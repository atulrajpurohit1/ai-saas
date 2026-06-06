import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiGovernanceService } from './ai-governance.service';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';

@Controller('ai-prompts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.governance')
export class AiPromptsController {
  constructor(private readonly aiGovernanceService: AiGovernanceService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.aiGovernanceService.listPrompts(user.tenantId);
  }

  @Post()
  create(
    @GetUser() user: ActiveUser,
    @Body() dto: CreatePromptVersionDto,
  ) {
    return this.aiGovernanceService.createPromptVersion(
      user.tenantId,
      user.sub,
      dto,
    );
  }

  @Post(':id/activate')
  activate(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.aiGovernanceService.activatePromptVersion(
      id,
      user.tenantId,
      user.sub,
    );
  }

  @Post(':id/deactivate')
  deactivate(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.aiGovernanceService.deactivatePromptVersion(
      id,
      user.tenantId,
      user.sub,
    );
  }
}
