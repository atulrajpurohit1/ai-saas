import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CompanyInsightDto } from './dto/company-insight.dto';
import { ImportProspectDto } from './dto/import-prospect.dto';
import { RenameSavedSearchDto } from './dto/rename-saved-search.dto';
import { SaveSearchDto } from './dto/save-search.dto';
import { SearchProspectsDto } from './dto/search-prospects.dto';
import { ViewProspectDto } from './dto/view-prospect.dto';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import { ProspectSearchService } from './prospect-search.service';
import { SavedProspectSearchService } from './saved-prospect-search.service';
export declare class ProspectSearchController {
    private readonly prospectSearchService;
    private readonly historyService;
    private readonly savedSearchService;
    constructor(prospectSearchService: ProspectSearchService, historyService: ProspectSearchHistoryService, savedSearchService: SavedProspectSearchService);
    search(dto: SearchProspectsDto, user: ActiveUser): Promise<import("./types/prospect-search.types").ProspectSearchResult>;
    recordView(dto: ViewProspectDto, user: ActiveUser): Promise<{
        ok: true;
    }>;
    getCompanyInsight(dto: CompanyInsightDto, user: ActiveUser): Promise<import("../ai/ai.service").ProspectCompanyInsight>;
    importCompany(dto: ImportProspectDto, user: ActiveUser): Promise<import("./types/prospect-search.types").ImportProspectResult>;
    getHistory(user: ActiveUser, limit?: string): Promise<{
        id: string;
        tenantId: string;
        userId: string;
        prompt: string;
        provider: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
        resultCount: number;
        searchedAt: Date;
    }[]>;
    getSavedSearches(user: ActiveUser): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        userId: string;
        prompt: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    createSavedSearch(dto: SaveSearchDto, user: ActiveUser): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        userId: string;
        prompt: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
    }>;
    renameSavedSearch(id: string, dto: RenameSavedSearchDto, user: ActiveUser): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        userId: string;
        prompt: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
    }>;
    removeSavedSearch(id: string, user: ActiveUser): Promise<{
        success: boolean;
    }>;
}
