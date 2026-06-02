import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiFeedbackController } from './ai-feedback.controller';
import { AiMonitoringController } from './ai-monitoring.controller';
import { AiMonitoringService } from './ai-monitoring.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiFeedbackController, AiMonitoringController],
  providers: [AiMonitoringService],
  exports: [AiMonitoringService],
})
export class AiMonitoringModule {}
