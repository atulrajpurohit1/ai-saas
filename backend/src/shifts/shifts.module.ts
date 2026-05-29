import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { ShiftRecommendationsController } from './shift-recommendations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ShiftsController, ShiftRecommendationsController],
  providers: [ShiftsService],
})
export class ShiftsModule {}
