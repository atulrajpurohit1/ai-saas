import { Module } from '@nestjs/common';
import { PatrolsService } from './patrols.service';
import { PatrolsController } from './patrols.controller';
import { GuardPatrolsController } from './guard-patrols.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PatrolsController, GuardPatrolsController],
  providers: [PatrolsService],
  exports: [PatrolsService],
})
export class PatrolsModule {}
