"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntitlementsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const module_guard_1 = require("../auth/guards/module.guard");
const entitlements_service_1 = require("./entitlements.service");
let EntitlementsModule = class EntitlementsModule {
};
exports.EntitlementsModule = EntitlementsModule;
exports.EntitlementsModule = EntitlementsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        providers: [entitlements_service_1.EntitlementsService, module_guard_1.ModuleGuard],
        exports: [entitlements_service_1.EntitlementsService, module_guard_1.ModuleGuard],
    })
], EntitlementsModule);
//# sourceMappingURL=entitlements.module.js.map