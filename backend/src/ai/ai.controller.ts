import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiService, AiProposalDraftResponse } from './ai.service';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('proposal-draft')
  @RequirePermission('ai.view', 'proposals.create')
  @HttpCode(HttpStatus.OK)
  generateProposalDraft(
    @Body() dto: GenerateProposalDto,
  ): Promise<AiProposalDraftResponse> {
    return this.aiService.generateProposalDraft(dto);
  }
}
