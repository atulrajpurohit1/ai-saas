import { Module } from '@nestjs/common';
import { AiGovernanceModule } from '../ai-governance/ai-governance.module';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';
import { AiActionsModule } from '../ai-actions/ai-actions.module';
import { AiMonitoringModule } from '../ai-monitoring/ai-monitoring.module';
import { CommandCenterController } from './command-center.controller';
import { CommandCenterService } from './command-center.service';

@Module({
  imports: [PrismaModule, AiModule, AiInsightsModule, AiActionsModule, AiMonitoringModule, AiGovernanceModule],
  controllers: [CommandCenterController],
  providers: [CommandCenterService],
})
export class CommandCenterModule {}
