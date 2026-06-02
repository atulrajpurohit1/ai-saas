import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiAuditController } from './ai-audit.controller';
import { AiGovernanceService } from './ai-governance.service';
import { AiPromptsController } from './ai-prompts.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AiPromptsController, AiAuditController],
  providers: [AiGovernanceService],
  exports: [AiGovernanceService],
})
export class AiGovernanceModule {}
