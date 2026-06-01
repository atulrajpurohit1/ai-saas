import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';
import { AiActionsModule } from '../ai-actions/ai-actions.module';
import { CommandCenterController } from './command-center.controller';
import { CommandCenterService } from './command-center.service';

@Module({
  imports: [PrismaModule, AiModule, AiInsightsModule, AiActionsModule],
  controllers: [CommandCenterController],
  providers: [CommandCenterService],
})
export class CommandCenterModule {}
