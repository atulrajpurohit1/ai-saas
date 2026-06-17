import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmConnectorsController } from './crm-connectors.controller';
import { CrmConnectorsService } from './crm-connectors.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CrmConnectorsController],
  providers: [CrmConnectorsService],
})
export class CrmConnectorsModule {}
