import { ConfigService } from '@nestjs/config';
import { ProspectDiscoveryResult } from './types/prospect-search.types';
export declare class ProspectDiscoveryCacheService {
    private readonly configService;
    private readonly cache;
    private readonly ttlMs;
    private hits;
    private misses;
    constructor(configService: ConfigService);
    buildKey(tenantId: string, provider: string, normalizedQuery: string): string;
    get(key: string): ProspectDiscoveryResult | null;
    set(key: string, result: ProspectDiscoveryResult): void;
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        hitRatio: number;
    };
    private cleanup;
}
