import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ProspectSearchRateLimitService } from './prospect-search-rate-limit.service';
export declare class ProspectSearchRateLimitGuard implements CanActivate {
    private readonly rateLimitService;
    constructor(rateLimitService: ProspectSearchRateLimitService);
    canActivate(context: ExecutionContext): boolean;
}
