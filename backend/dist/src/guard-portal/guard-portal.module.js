"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardPortalModule = void 0;
const common_1 = require("@nestjs/common");
const guard_portal_controller_1 = require("./guard-portal.controller");
const guard_portal_service_1 = require("./guard-portal.service");
let GuardPortalModule = class GuardPortalModule {
};
exports.GuardPortalModule = GuardPortalModule;
exports.GuardPortalModule = GuardPortalModule = __decorate([
    (0, common_1.Module)({
        controllers: [guard_portal_controller_1.GuardPortalController],
        providers: [guard_portal_service_1.GuardPortalService],
    })
], GuardPortalModule);
//# sourceMappingURL=guard-portal.module.js.map