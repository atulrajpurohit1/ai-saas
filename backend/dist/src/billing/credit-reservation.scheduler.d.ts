import { CreditsService } from './credits.service';
export declare class CreditReservationScheduler {
    private readonly credits;
    private readonly logger;
    private running;
    private static readonly STALE_AFTER_MINUTES;
    constructor(credits: CreditsService);
    sweep(): Promise<{
        expired: number;
        released: number;
    } | undefined>;
}
