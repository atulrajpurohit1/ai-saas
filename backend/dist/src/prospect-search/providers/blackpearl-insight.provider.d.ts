import { ConfigService } from '@nestjs/config';
import { ProspectCompanyInsight, ProspectCompanySummary } from '../../ai/ai.service';
export interface BlackPearlJobResult {
    jobId: string;
    status: 'pending' | 'completed' | 'failed';
    progress: number | null;
    companyName: string | null;
    insight: ProspectCompanyInsight | null;
}
export declare class BlackPearlInsightProvider {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    isConfigured(): boolean;
    submitPlaybookJob(company: ProspectCompanySummary): Promise<string | null>;
    getJobResult(jobId: string): Promise<BlackPearlJobResult | null>;
    getPlaybook(company: ProspectCompanySummary): Promise<ProspectCompanyInsight | null>;
    private getBaseUrl;
    private getBrandProfileKey;
    private buildHeaders;
    private request;
    private logCompleteErrorResponse;
}
