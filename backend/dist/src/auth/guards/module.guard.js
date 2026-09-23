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
exports.ModuleGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const module_decorator_1 = require("../decorators/module.decorator");
const entitlements_service_1 = require("../../entitlements/entitlements.service");
const entitlements_constants_1 = require("../../entitlements/entitlements.constants");
let ModuleGuard = class ModuleGuard {
    reflector;
    entitlements;
    constructor(reflector, entitlements) {
        this.reflector = reflector;
        this.entitlements = entitlements;
    }
    async canActivate(context) {
        const required = this.reflector.getAllAndMerge(module_decorator_1.SERVICE_MODULES_KEY, [context.getClass(), context.getHandler()]);
        if (!required || required.length === 0)
            return true;
        const request = context
            .switchToHttp()
            .getRequest();
        const user = request.user;
        if (!user?.tenantId)
            return false;
        const allowed = await this.entitlements.hasAnyModule(user.tenantId, required);
        if (!allowed) {
            const names = required
                .map((module) => entitlements_constants_1.SERVICE_MODULE_LABELS[module])
                .join(' or ');
            throw new common_1.ForbiddenException({
                statusCode: 403,
                error: 'Forbidden',
                upgradeRequired: true,
                modules: required,
                message: `Your plan does not include ${names}. Upgrade to enable it.`,
            });
        }
        return true;
    }
};
exports.ModuleGuard = ModuleGuard;
exports.ModuleGuard = ModuleGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        entitlements_service_1.EntitlementsService])
], ModuleGuard);
//# sourceMappingURL=module.guard.js.map