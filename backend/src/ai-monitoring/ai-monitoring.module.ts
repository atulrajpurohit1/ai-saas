import { Module } from '@nestjs/common';
import { AiGovernanceModule } from '../ai-governance/ai-governance.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiFeedbackController } from './ai-feedback.controller';
import { AiMonitoringController } from './ai-monitoring.controller';
import { AiMonitoringService } from './ai-monitoring.service';

@Module({
  imports: [PrismaModule, AiGovernanceModule],
  controllers: [AiFeedbackController, AiMonitoringController],
  providers: [AiMonitoringService],
  exports: [AiMonitoringService],
})
export class AiMonitoringModule {}
