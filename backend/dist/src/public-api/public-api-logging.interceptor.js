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
exports.PublicApiLoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const api_keys_service_1 = require("../api-keys/api-keys.service");
let PublicApiLoggingInterceptor = class PublicApiLoggingInterceptor {
    apiKeysService;
    constructor(apiKeysService) {
        this.apiKeysService = apiKeysService;
    }
    intercept(context, next) {
        const http = context.switchToHttp();
        const request = http.getRequest();
        const response = http.getResponse();
        return next.handle().pipe((0, rxjs_1.tap)(() => {
            void this.log(request, response.statusCode || 200);
        }), (0, rxjs_1.catchError)((error) => {
            const statusCode = typeof error?.getStatus === 'function'
                ? error.getStatus()
                : error?.status || 500;
            void this.log(request, statusCode);
            return (0, rxjs_1.throwError)(() => error);
        }));
    }
    async log(request, statusCode) {
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
exports.PublicApiLoggingInterceptor = PublicApiLoggingInterceptor;
exports.PublicApiLoggingInterceptor = PublicApiLoggingInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [api_keys_service_1.ApiKeysService])
], PublicApiLoggingInterceptor);
//# sourceMappingURL=public-api-logging.interceptor.js.map