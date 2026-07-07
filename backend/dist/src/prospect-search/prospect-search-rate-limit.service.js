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
exports.ProspectSearchRateLimitService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const DEFAULT_LIMIT_PER_MINUTE = 20;
let ProspectSearchRateLimitService = class ProspectSearchRateLimitService {
    configService;
    windows = new Map();
    limitPerMinute;
    constructor(configService) {
        this.configService = configService;
        const configured = Number(this.configService.get('PROSPECT_SEARCH_RATE_LIMIT_PER_MINUTE'));
        this.limitPerMinute =
            Number.isFinite(configured) && configured > 0
                ? configured
                : DEFAULT_LIMIT_PER_MINUTE;
    }
    check(userId) {
        const now = Date.now();
        const bucket = Math.floor(now / 60_000);
        const windowKey = `${userId}:${bucket}`;
        const existing = this.windows.get(windowKey);
        if (!existing || existing.resetAt <= now) {
            this.windows.set(windowKey, { count: 1, resetAt: (bucket + 1) * 60_000 });
            this.cleanup(now);
            return;
        }
        existing.count += 1;
        if (existing.count > this.limitPerMinute) {
            throw new common_1.HttpException('Prospect search rate limit exceeded. Please slow down and try again shortly.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    cleanup(now) {
        if (this.windows.size < 1000)
            return;
        for (const [key, window] of this.windows.entries()) {
            if (window.resetAt <= now) {
                this.windows.delete(key);
            }
        }
    }
};
exports.ProspectSearchRateLimitService = ProspectSearchRateLimitService;
exports.ProspectSearchRateLimitService = ProspectSearchRateLimitService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ProspectSearchRateLimitService);
//# sourceMappingURL=prospect-search-rate-limit.service.js.map