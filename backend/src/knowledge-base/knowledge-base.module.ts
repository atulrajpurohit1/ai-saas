import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, KnowledgeRetrievalService],
  exports: [KnowledgeBaseService, KnowledgeRetrievalService],
})
export class KnowledgeBaseModule {}
