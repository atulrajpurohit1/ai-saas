import { ProspectCompanyInsight } from '../../ai/ai.service';
export interface ProspectCompany {
    id: string;
    name: string;
    industry?: string;
    website?: string;
    city?: string;
    state?: string;
    country?: string;
    employeeCount?: number;
    revenueRange?: string;
    description?: string;
}
export interface ProspectSearchResult {
    companyName: string;
    insight: ProspectCompanyInsight;
}
export type ProspectSearchSubmission = {
    status: 'completed';
    companyName: string;
    insight: ProspectCompanyInsight;
} | {
    status: 'pending';
    jobId: string;
    companyName: string;
};
export type ProspectSearchJobStatusResult = {
    status: 'pending';
    progress: number | null;
} | {
    status: 'completed';
    companyName: string;
    insight: ProspectCompanyInsight;
} | {
    status: 'failed';
    message: string;
};
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
export interface DiscoveredProspectContact {
    fullName?: string;
    jobTitle?: string;
    headline?: string;
    location?: string;
    profileUrl?: string;
    email?: string;
}
export interface DiscoveredProspectSignal {
    label: string;
    snippet?: string;
}
export interface DiscoveredProspect {
    id: string;
    companyName?: string;
    companyDomain?: string;
    companyIndustry?: string;
    companyHeadcount?: number;
    companyLocation?: string;
    companyDescription?: string;
    contact: DiscoveredProspectContact;
    qualificationScore: number;
    qualificationReason?: string;
    signals: DiscoveredProspectSignal[];
}
export interface ProspectDiscoveryResult {
    query: string;
    discoveredCount: number;
    qualifiedCount: number;
    prospects: DiscoveredProspect[];
}
export type ProspectDiscoverySubmission = {
    status: 'completed';
    query: string;
    result: ProspectDiscoveryResult;
} | {
    status: 'pending';
    jobId: string;
    query: string;
};
export type ProspectDiscoveryJobStatusResult = {
    status: 'pending';
    progress: number | null;
    stageLabel: string | null;
} | {
    status: 'completed';
    query: string;
    result: ProspectDiscoveryResult;
} | {
    status: 'failed';
    message: string;
};
