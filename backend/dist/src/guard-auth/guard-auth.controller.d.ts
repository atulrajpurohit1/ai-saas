import { Request } from 'express';
import { GuardLoginDto } from './dto/guard-login.dto';
import { GuardAuthService } from './guard-auth.service';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
export declare class GuardAuthController {
    private readonly guardAuthService;
    private readonly rateLimit;
    constructor(guardAuthService: GuardAuthService, rateLimit: AuthRateLimitService);
    login(dto: GuardLoginDto, req: Request): Promise<{
        guard: {
            id: string;
            name: string;
            phone: string | null;
            email: string | null;
            tenantId: string;
            tenantName: string;
        };
        access_token: string;
        refresh_token: string;
    }>;
    refreshTokens(req: Request): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(req: Request): Promise<boolean>;
}
