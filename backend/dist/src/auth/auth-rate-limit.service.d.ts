import { ConfigService } from '@nestjs/config';
export declare class AuthRateLimitService {
    private readonly configService;
    private readonly windows;
    private readonly multiplier;
    constructor(configService: ConfigService);
    consume(key: string, limit: number, windowSeconds: number): void;
    private cleanup;
}
