import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { GuardPortalController } from './guard-portal.controller';
import { GuardPortalService } from './guard-portal.service';

import { IncidentsModule } from '../incidents/incidents.module';
import { PatrolsModule } from '../patrols/patrols.module';

@Module({
  imports: [AuditModule, IncidentsModule, PatrolsModule],
  controllers: [GuardPortalController],
  providers: [GuardPortalService],
})
export class GuardPortalModule {}
