import { ConfigService } from '@nestjs/config';
import { ProspectSearchResult } from './types/prospect-search.types';
export declare class ProspectSearchCacheService {
    private readonly configService;
    private readonly cache;
    private readonly ttlMs;
    private hits;
    private misses;
    constructor(configService: ConfigService);
    private buildKey;
    get(tenantId: string, prompt: string, provider: string): ProspectSearchResult | null;
    set(tenantId: string, prompt: string, provider: string, result: ProspectSearchResult): void;
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        hitRatio: number;
    };
    private cleanup;
}
