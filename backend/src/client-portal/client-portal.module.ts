import { Module } from '@nestjs/common';
import { ClientPortalController } from './client-portal.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ProposalsModule } from '../proposals/proposals.module';

@Module({
  imports: [PrismaModule, AuditModule, ProposalsModule],
  controllers: [ClientPortalController],
})
export class ClientPortalModule {}
