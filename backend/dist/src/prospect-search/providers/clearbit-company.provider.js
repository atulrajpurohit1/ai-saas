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
var ClearbitCompanyProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClearbitCompanyProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ClearbitCompanyProvider = ClearbitCompanyProvider_1 = class ClearbitCompanyProvider {
    configService;
    logger = new common_1.Logger(ClearbitCompanyProvider_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    hasApiKey() {
        return Boolean(this.configService.get('CLEARBIT_API_KEY'));
    }
    async findAll() {
        this.logger.warn(`Clearbit provider selected but not yet implemented (API key configured: ${this.hasApiKey()}).`);
        throw new common_1.ServiceUnavailableException('The Clearbit company-data provider is not yet implemented. Set COMPANY_PROVIDER=mock to use the built-in sample dataset.');
    }
};
exports.ClearbitCompanyProvider = ClearbitCompanyProvider;
exports.ClearbitCompanyProvider = ClearbitCompanyProvider = ClearbitCompanyProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ClearbitCompanyProvider);
//# sourceMappingURL=clearbit-company.provider.js.map