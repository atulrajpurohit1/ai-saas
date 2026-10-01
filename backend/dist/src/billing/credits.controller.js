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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const module_guard_1 = require("../auth/guards/module.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const module_decorator_1 = require("../auth/decorators/module.decorator");
const audit_service_1 = require("../audit/audit.service");
const billing_config_1 = require("./billing.config");
const credit_packs_constants_1 = require("./credit-packs.constants");
const credits_service_1 = require("./credits.service");
const grant_credits_dto_1 = require("./dto/grant-credits.dto");
const purchase_credits_dto_1 = require("./dto/purchase-credits.dto");
const stripe_service_1 = require("./stripe.service");
let CreditsController = class CreditsController {
    credits;
    stripe;
    audit;
    constructor(credits, stripe, audit) {
        this.credits = credits;
        this.stripe = stripe;
        this.audit = audit;
    }
    getBalance(user) {
        return this.credits.getBalance(user.tenantId);
    }
    getPacks() {
        return {
            configured: (0, billing_config_1.isCheckoutConfigured)(),
            packs: (0, credit_packs_constants_1.sellableCreditPacks)(),
            costs: {
                playbook: (0, credit_packs_constants_1.playbookCreditCost)(),
                discoverySearch: (0, credit_packs_constants_1.fullDiscoveryCreditCost)(),
                discoveryPreview: (0, credit_packs_constants_1.previewDiscoveryCreditCost)(),
                previewLimit: credit_packs_constants_1.PREVIEW_RESULT_LIMIT,
                perProspect: null,
            },
        };
    }
    getLedger(user, limit) {
        const parsed = Number.parseInt(limit ?? '', 10);
        return this.credits.getLedger(user.tenantId, Number.isFinite(parsed) ? parsed : 50);
    }
    purchase(user, dto) {
        return this.stripe.createCreditPackCheckoutSession({
            tenantId: user.tenantId,
            pack: dto.pack,
            email: user.email,
        });
    }
    async grant(user, dto) {
        const result = await this.credits.grant({
            tenantId: user.tenantId,
            amount: dto.amount,
            description: dto.reason,
            userId: user.sub,
            type: client_1.CreditEntryType.ADJUSTMENT,
        });
        await this.audit.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CREDITS_ADJUSTED',
            entityType: 'CREDITS',
            details: `${dto.amount > 0 ? '+' : ''}${dto.amount} credits: ${dto.reason} (balance now ${result.balance})`,
        });
        return result;
    }
};
exports.CreditsController = CreditsController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequireAnyPermission)('billing.view', 'prospect_search.view', 'roles.view', 'users.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CreditsController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Get)('packs'),
    (0, permissions_decorator_1.RequireAnyPermission)('billing.view', 'prospect_search.view', 'users.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CreditsController.prototype, "getPacks", null);
__decorate([
    (0, common_1.Get)('ledger'),
    (0, permissions_decorator_1.RequireAnyPermission)('billing.view', 'users.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CreditsController.prototype, "getLedger", null);
__decorate([
    (0, common_1.Post)('checkout/session'),
    (0, permissions_decorator_1.RequirePermission)('billing.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, purchase_credits_dto_1.PurchaseCreditsDto]),
    __metadata("design:returntype", void 0)
], CreditsController.prototype, "purchase", null);
__decorate([
    (0, common_1.Post)('grant'),
    (0, permissions_decorator_1.RequirePermission)('billing.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grant_credits_dto_1.GrantCreditsDto]),
    __metadata("design:returntype", Promise)
], CreditsController.prototype, "grant", null);
exports.CreditsController = CreditsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard, module_guard_1.ModuleGuard),
    (0, module_decorator_1.RequireModule)('LEAD_GEN'),
    (0, common_1.Controller)('billing/credits'),
    __metadata("design:paramtypes", [credits_service_1.CreditsService,
        stripe_service_1.StripeService,
        audit_service_1.AuditService])
], CreditsController);
//# sourceMappingURL=credits.controller.js.map