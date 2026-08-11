import { ConfigService } from '@nestjs/config';
import { ProspectDiscoveryResult } from '../types/prospect-search.types';
export interface ProspectingTargetInput {
    locations?: string[];
    industries?: string[];
    jobTitles?: string[];
    keywords?: string[];
    companyHeadcountMin?: number;
    companyHeadcountMax?: number;
}
export interface ProspectingSubmissionInput {
    objective: string;
    target?: ProspectingTargetInput;
    limit?: number;
}
export interface ProspectingJobPollResult {
    status: 'pending' | 'completed' | 'failed';
    progress: number | null;
    stageLabel: string | null;
    result: ProspectDiscoveryResult | null;
}
export declare class BlackPearlProspectingProvider {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    isConfigured(): boolean;
    submitProspectingJob(input: ProspectingSubmissionInput): Promise<string | null>;
    getJobResult(jobId: string): Promise<ProspectingJobPollResult | null>;
    private getBaseUrl;
    private getProductInfo;
}
