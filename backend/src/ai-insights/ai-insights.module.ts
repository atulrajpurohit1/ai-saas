import { Module } from '@nestjs/common';
import { AiGovernanceModule } from '../ai-governance/ai-governance.module';
import { AiModule } from '../ai/ai.module';
import { AiMonitoringModule } from '../ai-monitoring/ai-monitoring.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { RecommendationService } from './recommendation.service';
import { RevenueInsightsService } from './revenue-insights.service';

@Module({
  imports: [PrismaModule, AiModule, AiMonitoringModule, AiGovernanceModule, KnowledgeBaseModule],
  controllers: [AiInsightsController],
  providers: [AiInsightsService, RevenueInsightsService, RecommendationService],
  exports: [AiInsightsService, RevenueInsightsService, RecommendationService],
})
export class AiInsightsModule {}
