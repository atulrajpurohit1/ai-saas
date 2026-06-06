"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const api_keys_service_1 = require("../api-keys/api-keys.service");
const public_api_decorator_1 = require("./public-api.decorator");
const public_api_rate_limit_service_1 = require("./public-api-rate-limit.service");
let PublicApiKeyGuard = class PublicApiKeyGuard {
    reflector;
    apiKeysService;
    rateLimitService;
    constructor(reflector, apiKeysService, rateLimitService) {
        this.reflector = reflector;
        this.apiKeysService = apiKeysService;
        this.rateLimitService = rateLimitService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const apiKey = await this.apiKeysService.authenticate(this.extractApiKey(request));
        request.publicApiKey = apiKey;
        const requiredPermission = this.reflector.getAllAndOverride(public_api_decorator_1.PUBLIC_API_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
        if (requiredPermission &&
            !apiKey.permissions.includes(requiredPermission)) {
            await this.logDeniedRequest(request, 403);
            throw new common_1.ForbiddenException(`API key is missing ${requiredPermission}`);
        }
        try {
            this.rateLimitService.check(apiKey.id, apiKey.rateLimitPerMinute);
        }
        catch (error) {
            await this.logDeniedRequest(request, 429);
            throw error;
        }
        await this.apiKeysService.touch(apiKey.id);
        return true;
    }
    extractApiKey(request) {
        const directHeader = request.headers['x-api-key'];
        if (Array.isArray(directHeader)) {
            return directHeader[0];
        }
        if (typeof directHeader === 'string') {
            return directHeader;
        }
        const authorization = request.headers.authorization;
        const value = Array.isArray(authorization) ? authorization[0] : authorization;
        if (value?.toLowerCase().startsWith('bearer ')) {
            return value.slice(7);
        }
        return undefined;
    }
    async logDeniedRequest(request, statusCode) {
        if (!request.publicApiKey)
            return;
        await this.apiKeysService.logRequest({
            apiKey: request.publicApiKey,
            endpoint: request.originalUrl || request.url || 'unknown',
            method: request.method,
            statusCode,
            ipAddress: this.getIpAddress(request),
            userAgent: this.getHeader(request, 'user-agent'),
        });
    }
    getIpAddress(request) {
        return this.getHeader(request, 'x-forwarded-for')?.split(',')[0]?.trim()
            || request.ip
            || request.socket?.remoteAddress
            || null;
    }
    getHeader(request, key) {
        const value = request.headers[key];
        if (Array.isArray(value))
            return value[0];
        return value || null;
    }
};
exports.PublicApiKeyGuard = PublicApiKeyGuard;
exports.PublicApiKeyGuard = PublicApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        api_keys_service_1.ApiKeysService,
        public_api_rate_limit_service_1.PublicApiRateLimitService])
], PublicApiKeyGuard);
//# sourceMappingURL=public-api-key.guard.js.map