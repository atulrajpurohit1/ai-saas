import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { GuardPortalController } from './guard-portal.controller';
import { GuardPortalService } from './guard-portal.service';

@Module({
  imports: [AuditModule],
  controllers: [GuardPortalController],
  providers: [GuardPortalService],
})
export class GuardPortalModule {}
