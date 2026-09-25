import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { AiModule } from '../ai/ai.module';
import { ClientReportsController } from './client-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportDeliveryScheduler } from './report-delivery.scheduler';

@Module({
  imports: [PrismaModule, AuditModule, EmailModule, AiModule],
  controllers: [ReportsController, ClientReportsController],
  providers: [ReportsService, ReportDeliveryScheduler],
})
export class ReportsModule {}
