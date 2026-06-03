import { Module } from '@nestjs/common';
import { CommandCenterModule } from '../ai-command-center/command-center.module';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';
import { AiMonitoringModule } from '../ai-monitoring/ai-monitoring.module';
import { AiPredictionsModule } from '../ai-predictions/ai-predictions.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { AiExecutiveCenterController } from './ai-executive-center.controller';
import { AiExecutiveCenterService } from './ai-executive-center.service';

@Module({
  imports: [
    AiModule,
    AuditModule,
    AiInsightsModule,
    AiMonitoringModule,
    AiPredictionsModule,
    CommandCenterModule,
    KnowledgeBaseModule,
  ],
  controllers: [AiExecutiveCenterController],
  providers: [AiExecutiveCenterService],
})
export class AiExecutiveCenterModule {}
