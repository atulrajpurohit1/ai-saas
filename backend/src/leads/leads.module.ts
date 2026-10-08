import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { CrmImportService } from './import/crm-import.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, AiModule, BillingModule],
  controllers: [LeadsController],
  providers: [LeadsService, CrmImportService],
  exports: [LeadsService, CrmImportService],
})
export class LeadsModule {}
