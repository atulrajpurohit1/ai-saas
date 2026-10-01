import { ConfigService } from '@nestjs/config';
import { BlackPearlProspectingProvider } from './providers/blackpearl-prospecting.provider';
export declare class UpstreamBudgetService {
    private readonly configService;
    private readonly provider;
    private readonly logger;
    private cached;
    private lastKnownBalanceUsd;
    constructor(configService: ConfigService, provider: BlackPearlProspectingProvider);
    private reserveFloorUsd;
    getBalanceUsd(force?: boolean): Promise<number | null>;
    assertCanSpend(): Promise<void>;
    invalidate(): void;
}
