import { AiService, ProspectCompanyInsight } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { CompanyInsightDto } from './dto/company-insight.dto';
import { ImportProspectDto } from './dto/import-prospect.dto';
import { SearchProspectsDto } from './dto/search-prospects.dto';
import { ViewProspectDto } from './dto/view-prospect.dto';
import { BlackPearlInsightProvider } from './providers/blackpearl-insight.provider';
import { ProspectSearchCacheService } from './prospect-search-cache.service';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import { ImportProspectResult, ProspectSearchJobStatusResult, ProspectSearchSubmission } from './types/prospect-search.types';
export declare class ProspectSearchService {
    private readonly aiService;
    private readonly auditService;
    private readonly leadsService;
    private readonly notesService;
    private readonly cacheService;
    private readonly historyService;
    private readonly blackPearlInsightProvider;
    private readonly logger;
    constructor(aiService: AiService, auditService: AuditService, leadsService: LeadsService, notesService: NotesService, cacheService: ProspectSearchCacheService, historyService: ProspectSearchHistoryService, blackPearlInsightProvider: BlackPearlInsightProvider);
    search(dto: SearchProspectsDto, user: ActiveUser): Promise<ProspectSearchSubmission>;
    getSearchJobStatus(jobId: string, user: ActiveUser): Promise<ProspectSearchJobStatusResult>;
    private recordHistory;
    recordView(dto: ViewProspectDto, user: ActiveUser): Promise<{
        ok: true;
    }>;
    getCompanyInsight(dto: CompanyInsightDto, user: ActiveUser): Promise<ProspectCompanyInsight>;
    importCompany(dto: ImportProspectDto, user: ActiveUser): Promise<ImportProspectResult>;
    private extractDomain;
    private buildImportNote;
}
