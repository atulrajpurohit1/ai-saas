import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClientComplianceController } from './client-compliance.controller';
import { ClientPortalInsuranceController } from './client-portal-insurance.controller';
import { ClientComplianceService } from './client-compliance.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ClientComplianceController, ClientPortalInsuranceController],
  providers: [ClientComplianceService],
})
export class ClientComplianceModule {}
