import { Module } from '@nestjs/common';
import { EmergencyAlertsService } from './emergency-alerts.service';
import { EmergencyAlertsController } from './emergency-alerts.controller';
import { GuardEmergencyAlertsController } from './guard-emergency-alerts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [EmergencyAlertsController, GuardEmergencyAlertsController],
  providers: [EmergencyAlertsService],
  exports: [EmergencyAlertsService],
})
export class EmergencyAlertsModule {}
