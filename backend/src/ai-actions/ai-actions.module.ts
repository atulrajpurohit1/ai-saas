import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { AuditModule } from '../audit/audit.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiActionsService } from './ai-actions.service';

@Module({
  imports: [PrismaModule, AuditModule, ActivitiesModule, KnowledgeBaseModule],
  providers: [AiActionsService],
  exports: [AiActionsService],
})
export class AiActionsModule {}
