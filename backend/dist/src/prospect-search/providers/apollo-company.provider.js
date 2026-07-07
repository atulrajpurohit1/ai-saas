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
var ApolloCompanyProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApolloCompanyProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ApolloCompanyProvider = ApolloCompanyProvider_1 = class ApolloCompanyProvider {
    configService;
    logger = new common_1.Logger(ApolloCompanyProvider_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    hasApiKey() {
        return Boolean(this.configService.get('APOLLO_API_KEY'));
    }
    async findAll() {
        this.logger.warn(`Apollo provider selected but not yet implemented (API key configured: ${this.hasApiKey()}).`);
        throw new common_1.ServiceUnavailableException('The Apollo company-data provider is not yet implemented. Set COMPANY_PROVIDER=mock to use the built-in sample dataset.');
    }
};
exports.ApolloCompanyProvider = ApolloCompanyProvider;
exports.ApolloCompanyProvider = ApolloCompanyProvider = ApolloCompanyProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ApolloCompanyProvider);
//# sourceMappingURL=apollo-company.provider.js.map