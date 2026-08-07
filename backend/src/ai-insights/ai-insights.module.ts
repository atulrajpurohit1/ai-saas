import { Module } from '@nestjs/common';
import { AiGovernanceModule } from '../ai-governance/ai-governance.module';
import { AiModule } from '../ai/ai.module';
import { AiMonitoringModule } from '../ai-monitoring/ai-monitoring.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RecommendationService } from './recommendation.service';

/**
 * AiInsightsController/AiInsightsService/RevenueInsightsService (the standalone
 * AI Insights dashboard) were removed along with its frontend pages - out of
 * approved client scope. RecommendationService stays: Shifts depends on it for
 * guard recommendations.
 */
@Module({
  imports: [PrismaModule, AiModule, AiMonitoringModule, AiGovernanceModule],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class AiInsightsModule {}
