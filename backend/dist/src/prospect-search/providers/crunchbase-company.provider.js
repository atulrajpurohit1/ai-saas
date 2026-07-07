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
var CrunchbaseCompanyProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrunchbaseCompanyProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let CrunchbaseCompanyProvider = CrunchbaseCompanyProvider_1 = class CrunchbaseCompanyProvider {
    configService;
    logger = new common_1.Logger(CrunchbaseCompanyProvider_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    hasApiKey() {
        return Boolean(this.configService.get('CRUNCHBASE_API_KEY'));
    }
    async findAll() {
        this.logger.warn(`Crunchbase provider selected but not yet implemented (API key configured: ${this.hasApiKey()}).`);
        throw new common_1.ServiceUnavailableException('The Crunchbase company-data provider is not yet implemented. Set COMPANY_PROVIDER=mock to use the built-in sample dataset.');
    }
};
exports.CrunchbaseCompanyProvider = CrunchbaseCompanyProvider;
exports.CrunchbaseCompanyProvider = CrunchbaseCompanyProvider = CrunchbaseCompanyProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CrunchbaseCompanyProvider);
//# sourceMappingURL=crunchbase-company.provider.js.map