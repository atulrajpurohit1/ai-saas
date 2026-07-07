import { ConfigService } from '@nestjs/config';
export declare class ProspectSearchRateLimitService {
    private readonly configService;
    private readonly windows;
    private readonly limitPerMinute;
    constructor(configService: ConfigService);
    check(userId: string): void;
    private cleanup;
}
