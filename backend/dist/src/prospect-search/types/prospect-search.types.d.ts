import { ProspectSearchFilters } from '../../ai/ai.service';
export interface ProspectCompany {
    id: string;
    name: string;
    industry: string;
    website: string;
    city: string;
    state: string;
    country: string;
    employeeCount: number;
    revenueRange: string;
    description: string;
}
export interface RankedProspectCompany extends ProspectCompany {
    matchScore: number;
}
export interface ProspectSearchResult {
    prompt: string;
    filters: ProspectSearchFilters;
    results: RankedProspectCompany[];
    totalMatches: number;
}
export interface DuplicateLeadSummary {
    id: string;
    name: string;
    company: string;
}
export interface ImportedLeadSummary {
    id: string;
    name: string;
    company: string;
    email: string | null;
    status: string;
}
export type ImportProspectResult = {
    duplicate: true;
    existingLead: DuplicateLeadSummary;
} | {
    duplicate: false;
    lead: ImportedLeadSummary;
};
