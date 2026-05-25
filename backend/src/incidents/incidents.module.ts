import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GuardIncidentsController } from './guard-incidents.controller';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [IncidentsController, GuardIncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
