import { Module } from '@nestjs/common';
import { AiActionsModule } from '../ai-actions/ai-actions.module';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';
import { AiMonitoringModule } from '../ai-monitoring/ai-monitoring.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiPredictionsController } from './ai-predictions.controller';
import { PredictionEngineService } from './prediction-engine.service';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    AuditModule,
    AiInsightsModule,
    AiMonitoringModule,
    AiActionsModule,
    KnowledgeBaseModule,
  ],
  controllers: [AiPredictionsController],
  providers: [PredictionEngineService],
  exports: [PredictionEngineService],
})
export class AiPredictionsModule {}
