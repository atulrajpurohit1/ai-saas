import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiCopilotController } from './ai-copilot.controller';
import { AiCopilotService } from './ai-copilot.service';
import { CopilotQueryService } from './copilot-query.service';

@Module({
  imports: [PrismaModule, AuditModule, AiModule, AiInsightsModule],
  controllers: [AiCopilotController],
  providers: [AiCopilotService, CopilotQueryService],
})
export class AiCopilotModule {}
