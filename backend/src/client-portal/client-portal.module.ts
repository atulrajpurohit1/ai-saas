import { Module } from '@nestjs/common';
import { ClientPortalController } from './client-portal.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ClientPortalController],
})
export class ClientPortalModule {}
