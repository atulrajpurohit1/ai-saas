import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { RevenueInsightsService } from './revenue-insights.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [AiInsightsController],
  providers: [AiInsightsService, RevenueInsightsService],
  exports: [AiInsightsService, RevenueInsightsService],
})
export class AiInsightsModule {}
