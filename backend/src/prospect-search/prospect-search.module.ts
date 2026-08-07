import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { NotesModule } from '../notes/notes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BlackPearlInsightProvider } from './providers/blackpearl-insight.provider';
import { ProspectSearchCacheService } from './prospect-search-cache.service';
import { ProspectSearchController } from './prospect-search.controller';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import { ProspectSearchRateLimitService } from './prospect-search-rate-limit.service';
import { ProspectSearchService } from './prospect-search.service';
import { SavedProspectSearchService } from './saved-prospect-search.service';

@Module({
  imports: [
    ConfigModule,
    AiModule,
    AuditModule,
    LeadsModule,
    NotesModule,
    PrismaModule,
  ],
  controllers: [ProspectSearchController],
  providers: [
    ProspectSearchService,
    ProspectSearchCacheService,
    ProspectSearchHistoryService,
    ProspectSearchRateLimitService,
    SavedProspectSearchService,
    BlackPearlInsightProvider,
  ],
})
export class ProspectSearchModule {}
