"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicApiModule = void 0;
const common_1 = require("@nestjs/common");
const api_keys_module_1 = require("../api-keys/api-keys.module");
const audit_module_1 = require("../audit/audit.module");
const prisma_module_1 = require("../prisma/prisma.module");
const webhooks_module_1 = require("../webhooks/webhooks.module");
const public_api_controller_1 = require("./public-api.controller");
const public_api_key_guard_1 = require("./public-api-key.guard");
const public_api_logging_interceptor_1 = require("./public-api-logging.interceptor");
const public_api_rate_limit_service_1 = require("./public-api-rate-limit.service");
const public_api_service_1 = require("./public-api.service");
let PublicApiModule = class PublicApiModule {
};
exports.PublicApiModule = PublicApiModule;
exports.PublicApiModule = PublicApiModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule, api_keys_module_1.ApiKeysModule, webhooks_module_1.WebhooksModule],
        controllers: [public_api_controller_1.PublicApiController],
        providers: [
            public_api_service_1.PublicApiService,
            public_api_key_guard_1.PublicApiKeyGuard,
            public_api_logging_interceptor_1.PublicApiLoggingInterceptor,
            public_api_rate_limit_service_1.PublicApiRateLimitService,
        ],
    })
], PublicApiModule);
//# sourceMappingURL=public-api.module.js.map