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
exports.ProspectDiscoveryCacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const DEFAULT_TTL_SECONDS = 300;
const MAX_CACHE_SIZE = 500;
let ProspectDiscoveryCacheService = class ProspectDiscoveryCacheService {
    configService;
    cache = new Map();
    ttlMs;
    hits = 0;
    misses = 0;
    constructor(configService) {
        this.configService = configService;
        const ttlSeconds = Number(this.configService.get('PROSPECT_SEARCH_CACHE_TTL_SECONDS'));
        this.ttlMs =
            (Number.isFinite(ttlSeconds) && ttlSeconds > 0
                ? ttlSeconds
                : DEFAULT_TTL_SECONDS) * 1000;
    }
    buildKey(tenantId, provider, normalizedQuery) {
        return `${tenantId}::${provider}::${normalizedQuery}`;
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry || Date.now() > entry.expiresAt) {
            if (entry)
                this.cache.delete(key);
            this.misses += 1;
            return null;
        }
        this.hits += 1;
        return entry.result;
    }
    set(key, result) {
        this.cache.set(key, { result, expiresAt: Date.now() + this.ttlMs });
        this.cleanup();
    }
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRatio: total === 0 ? 0 : this.hits / total,
        };
    }
    cleanup() {
        if (this.cache.size < MAX_CACHE_SIZE)
            return;
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt <= now) {
                this.cache.delete(key);
            }
        }
    }
};
exports.ProspectDiscoveryCacheService = ProspectDiscoveryCacheService;
exports.ProspectDiscoveryCacheService = ProspectDiscoveryCacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ProspectDiscoveryCacheService);
//# sourceMappingURL=prospect-discovery-cache.service.js.map