import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiGovernanceService } from './ai-governance.service';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';

@Controller('ai-prompts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
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
