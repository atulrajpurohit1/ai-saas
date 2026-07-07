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
exports.ProspectSearchRateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const prospect_search_rate_limit_service_1 = require("./prospect-search-rate-limit.service");
let ProspectSearchRateLimitGuard = class ProspectSearchRateLimitGuard {
    rateLimitService;
    constructor(rateLimitService) {
        this.rateLimitService = rateLimitService;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        this.rateLimitService.check(request.user?.sub || 'anonymous');
        return true;
    }
};
exports.ProspectSearchRateLimitGuard = ProspectSearchRateLimitGuard;
exports.ProspectSearchRateLimitGuard = ProspectSearchRateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prospect_search_rate_limit_service_1.ProspectSearchRateLimitService])
], ProspectSearchRateLimitGuard);
//# sourceMappingURL=prospect-search-rate-limit.guard.js.map