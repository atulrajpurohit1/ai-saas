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
var UpstreamBudgetService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpstreamBudgetService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const blackpearl_prospecting_provider_1 = require("./providers/blackpearl-prospecting.provider");
const BALANCE_CACHE_MS = 60_000;
const DEFAULT_RESERVE_FLOOR_USD = 25;
let UpstreamBudgetService = UpstreamBudgetService_1 = class UpstreamBudgetService {
    configService;
    provider;
    logger = new common_1.Logger(UpstreamBudgetService_1.name);
    cached = null;
    lastKnownBalanceUsd = null;
    constructor(configService, provider) {
        this.configService = configService;
        this.provider = provider;
    }
    reserveFloorUsd() {
        const configured = Number(this.configService.get('BLACKPEARL_RESERVE_FLOOR_USD'));
        return Number.isFinite(configured) && configured >= 0
            ? configured
            : DEFAULT_RESERVE_FLOOR_USD;
    }
    async getBalanceUsd(force = false) {
        const now = Date.now();
        if (!force &&
            this.cached &&
            now - this.cached.fetchedAt < BALANCE_CACHE_MS) {
            return this.cached.balanceUsd;
        }
        let balanceUsd = null;
        try {
            balanceUsd = await this.provider.getUpstreamBalanceUsd();
        }
        catch (error) {
            this.logger.warn(`Could not read BlackPearl prepaid balance, falling back to last known value: ${error instanceof Error ? error.message : String(error)}`);
            return this.lastKnownBalanceUsd;
        }
        this.cached = { balanceUsd, fetchedAt: now };
        if (balanceUsd !== null) {
            this.lastKnownBalanceUsd = balanceUsd;
        }
        return balanceUsd;
    }
    async assertCanSpend() {
        const balanceUsd = await this.getBalanceUsd();
        if (balanceUsd === null)
            return;
        const floor = this.reserveFloorUsd();
        if (balanceUsd <= floor) {
            this.logger.error(`BlackPearl prepaid balance is $${balanceUsd.toFixed(2)}, at or below the $${floor.toFixed(2)} reserve floor. Refusing new Prospect Search jobs.`);
            throw new common_1.ServiceUnavailableException('Prospect Search is temporarily unavailable. Please try again later or contact support.');
        }
        if (balanceUsd <= floor * 4) {
            this.logger.warn(`BlackPearl prepaid balance is low: $${balanceUsd.toFixed(2)} remaining (floor $${floor.toFixed(2)}).`);
        }
    }
    invalidate() {
        this.cached = null;
    }
};
exports.UpstreamBudgetService = UpstreamBudgetService;
exports.UpstreamBudgetService = UpstreamBudgetService = UpstreamBudgetService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        blackpearl_prospecting_provider_1.BlackPearlProspectingProvider])
], UpstreamBudgetService);
//# sourceMappingURL=upstream-budget.service.js.map