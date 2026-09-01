import { Module } from '@nestjs/common';
import { RfpService } from './rfp.service';
import { RfpController } from './rfp.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AiGovernanceModule } from '../ai-governance/ai-governance.module';
import { EmailModule } from '../email/email.module';
import { ProposalsModule } from '../proposals/proposals.module';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    AiGovernanceModule,
    EmailModule,
    ProposalsModule,
  ],
  controllers: [RfpController],
  providers: [RfpService],
  exports: [RfpService],
})
export class RfpModule {}
