import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { CrmImportService } from './import/crm-import.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [LeadsController],
  providers: [LeadsService, CrmImportService],
  exports: [LeadsService, CrmImportService],
})
export class LeadsModule {}
