import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { NotesModule } from '../notes/notes.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  COMPANY_PROVIDER_NAME,
  COMPANY_REPOSITORY,
  CompanyRepository,
} from './interfaces/prospect-search.interface';
import { ApolloCompanyProvider } from './providers/apollo-company.provider';
import { ClearbitCompanyProvider } from './providers/clearbit-company.provider';
import { CrunchbaseCompanyProvider } from './providers/crunchbase-company.provider';
import {
  CompanyProviderName,
  resolveCompanyProviderName,
} from './providers/provider.config';
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
    ApolloCompanyProvider,
    CrunchbaseCompanyProvider,
    ClearbitCompanyProvider,
    {
      provide: COMPANY_PROVIDER_NAME,
      useFactory: (configService: ConfigService): CompanyProviderName =>
        resolveCompanyProviderName(
          configService.get<string>('COMPANY_PROVIDER'),
        ),
      inject: [ConfigService],
    },
    {
      provide: COMPANY_REPOSITORY,
      useFactory: (
        providerName: CompanyProviderName,
        apollo: ApolloCompanyProvider,
        crunchbase: CrunchbaseCompanyProvider,
        clearbit: ClearbitCompanyProvider,
      ): CompanyRepository => {
        switch (providerName) {
          case 'crunchbase':
            return crunchbase;
          case 'clearbit':
            return clearbit;
          case 'apollo':
          default:
            return apollo;
        }
      },
      inject: [
        COMPANY_PROVIDER_NAME,
        ApolloCompanyProvider,
        CrunchbaseCompanyProvider,
        ClearbitCompanyProvider,
      ],
    },
  ],
})
export class ProspectSearchModule {}
