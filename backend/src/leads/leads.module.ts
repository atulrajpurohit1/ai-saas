import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { CrmImportService } from './import/crm-import.service';
import { BillingModule } from '../billing/billing.module';
import { CrmConnectorsModule } from '../crm-connectors/crm-connectors.module';

@Module({
  imports: [PrismaModule, AiModule, BillingModule, CrmConnectorsModule],
  controllers: [LeadsController],
  providers: [LeadsService, CrmImportService],
  exports: [LeadsService, CrmImportService],
})
export class LeadsModule {}
