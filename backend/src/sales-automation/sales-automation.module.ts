import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesAutomationController } from './sales-automation.controller';
import { SalesAutomationService } from './sales-automation.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SalesAutomationController],
  providers: [SalesAutomationService],
})
export class SalesAutomationModule {}
