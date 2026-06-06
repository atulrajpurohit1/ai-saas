import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { PublicApiRateLimitService } from './public-api-rate-limit.service';
export declare class PublicApiKeyGuard implements CanActivate {
    private readonly reflector;
    private readonly apiKeysService;
    private readonly rateLimitService;
    constructor(reflector: Reflector, apiKeysService: ApiKeysService, rateLimitService: PublicApiRateLimitService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractApiKey;
    private logDeniedRequest;
    private getIpAddress;
    private getHeader;
}
