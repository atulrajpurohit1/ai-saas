import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientReportsController } from './client-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ReportsController, ClientReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
