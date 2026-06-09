import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiMonitoringModule } from '../ai-monitoring/ai-monitoring.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { SalesAcceleratorController } from './sales-accelerator.controller';
import { SalesAcceleratorService } from './sales-accelerator.service';

@Module({
  imports: [AiModule, AiMonitoringModule, ProposalsModule],
  controllers: [SalesAcceleratorController],
  providers: [SalesAcceleratorService],
})
export class SalesAcceleratorModule {}
