import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { ShiftRecommendationsController } from './shift-recommendations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';

@Module({
  imports: [PrismaModule, AiInsightsModule],
  controllers: [ShiftsController, ShiftRecommendationsController],
  providers: [ShiftsService],
})
export class ShiftsModule {}
