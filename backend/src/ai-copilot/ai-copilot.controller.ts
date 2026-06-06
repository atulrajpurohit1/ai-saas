import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiCopilotService } from './ai-copilot.service';
import { AskCopilotDto } from './dto/ask-copilot.dto';

@Controller('ai-copilot')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.view')
export class AiCopilotController {
  constructor(private readonly aiCopilotService: AiCopilotService) {}

  @Post('ask')
  ask(@GetUser() user: ActiveUser, @Body() dto: AskCopilotDto) {
    return this.aiCopilotService.ask({
      tenantId: user.tenantId,
      userId: user.sub,
      userRole: user.role,
      question: dto.question,
    });
  }

  @Get('history')
  history(@GetUser() user: ActiveUser, @Query('limit') limit?: string) {
    return this.aiCopilotService.history(
      user.tenantId,
      user.sub,
      limit ? Number(limit) : 25,
    );
  }

  @Get('suggested-questions')
  suggestedQuestions(@GetUser() user: ActiveUser) {
    return this.aiCopilotService.getSuggestedQuestions(user.role);
  }
}
