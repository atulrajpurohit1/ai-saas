import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiActionsService } from './ai-actions.service';

@Module({
  imports: [PrismaModule, AuditModule, ActivitiesModule],
  providers: [AiActionsService],
  exports: [AiActionsService],
})
export class AiActionsModule {}
