import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { AiModule } from '../ai/ai.module';
import { AiMonitoringModule } from '../ai-monitoring/ai-monitoring.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { SalesAcceleratorController } from './sales-accelerator.controller';
import { SalesAcceleratorService } from './sales-accelerator.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    ActivitiesModule,
    AiModule,
    AiMonitoringModule,
    ProposalsModule,
    BillingModule,
  ],
  controllers: [SalesAcceleratorController],
  providers: [SalesAcceleratorService],
})
export class SalesAcceleratorModule {}
