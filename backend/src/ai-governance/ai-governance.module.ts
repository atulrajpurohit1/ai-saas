import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiGovernanceService } from './ai-governance.service';

/**
 * AiPromptsController and AiAuditController (the admin prompt-registry and
 * audit-log UIs) were removed along with their frontend pages - out of
 * approved client scope. AiGovernanceService itself stays: AiMonitoringService
 * requires it for Sales Accelerator's generation logging.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  providers: [AiGovernanceService],
  exports: [AiGovernanceService],
})
export class AiGovernanceModule {}
