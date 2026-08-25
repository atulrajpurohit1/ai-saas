import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { GuardComplianceController } from './guard-compliance.controller';
import { GuardComplianceService } from './guard-compliance.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [GuardComplianceController],
  providers: [GuardComplianceService],
})
export class GuardComplianceModule {}
