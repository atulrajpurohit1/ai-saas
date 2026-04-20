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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Roles('admin')
  @Post('proposal-draft')
  @HttpCode(HttpStatus.OK)
  generateProposalDraft(
    @Body() dto: GenerateProposalDto,
  ): Promise<AiProposalDraftResponse> {
    return this.aiService.generateProposalDraft(dto);
  }
}
