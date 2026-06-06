"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicApiRateLimitService = void 0;
const common_1 = require("@nestjs/common");
let PublicApiRateLimitService = class PublicApiRateLimitService {
    windows = new Map();
    check(apiKeyId, limit) {
        const now = Date.now();
        const bucket = Math.floor(now / 60_000);
        const windowKey = `${apiKeyId}:${bucket}`;
        const existing = this.windows.get(windowKey);
        if (!existing || existing.resetAt <= now) {
            this.windows.set(windowKey, {
                count: 1,
                resetAt: (bucket + 1) * 60_000,
            });
            this.cleanup(now);
            return;
        }
        existing.count += 1;
        if (existing.count > limit) {
            throw new common_1.HttpException('API key rate limit exceeded', common_1.HttpStatus.TOO_MANY_REQUESTS);
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
exports.PublicApiRateLimitService = PublicApiRateLimitService;
exports.PublicApiRateLimitService = PublicApiRateLimitService = __decorate([
    (0, common_1.Injectable)()
], PublicApiRateLimitService);
//# sourceMappingURL=public-api-rate-limit.service.js.map