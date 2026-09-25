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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const billing_service_1 = require("./billing.service");
const stripe_service_1 = require("./stripe.service");
const create_checkout_session_dto_1 = require("./dto/create-checkout-session.dto");
const billing_config_1 = require("./billing.config");
const guard_metering_service_1 = require("./guard-metering.service");
const pricing_constants_1 = require("./pricing.constants");
let BillingController = class BillingController {
    billingService;
    stripe;
    metering;
    constructor(billingService, stripe, metering) {
        this.billingService = billingService;
        this.stripe = stripe;
        this.metering = metering;
    }
    getBilling(user) {
        return this.billingService.getTenantBilling(user.tenantId);
    }
    checkoutAvailability() {
        return {
            configured: (0, billing_config_1.isCheckoutConfigured)(),
            monthly: (0, billing_config_1.sellableModules)('monthly'),
            annual: (0, billing_config_1.sellableModules)('annual'),
        };
    }
    pricing() {
        return {
            bands: pricing_constants_1.GUARD_BANDS,
            packages: Object.entries(pricing_constants_1.PACKAGE_LABELS).map(([key, name]) => ({
                key,
                name,
                modules: pricing_constants_1.PACKAGE_MODULES[key],
                monthly: pricing_constants_1.MONTHLY_PRICES[key],
            })),
        };
    }
    usage(user) {
        return this.metering.billingProfile(user.tenantId);
    }
    createCheckoutSession(user, dto) {
        return this.stripe.createCheckoutSession({
            tenantId: user.tenantId,
            modules: dto.modules,
            interval: dto.interval ?? 'monthly',
            email: user.email,
        });
    }
    createPortalSession(user) {
        return this.stripe.createPortalSession(user.tenantId);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequireAnyPermission)('billing.view', 'roles.view', 'users.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getBilling", null);
__decorate([
    (0, common_1.Get)('checkout/availability'),
    (0, permissions_decorator_1.RequireAnyPermission)('billing.view', 'roles.view', 'users.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "checkoutAvailability", null);
__decorate([
    (0, common_1.Get)('pricing'),
    (0, permissions_decorator_1.RequireAnyPermission)('billing.view', 'roles.view', 'users.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "pricing", null);
__decorate([
    (0, common_1.Get)('usage'),
    (0, permissions_decorator_1.RequireAnyPermission)('billing.view', 'roles.view', 'users.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "usage", null);
__decorate([
    (0, common_1.Post)('checkout/session'),
    (0, permissions_decorator_1.RequirePermission)('billing.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_checkout_session_dto_1.CreateCheckoutSessionDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "createCheckoutSession", null);
__decorate([
    (0, common_1.Post)('portal/session'),
    (0, permissions_decorator_1.RequirePermission)('billing.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "createPortalSession", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, common_1.Controller)('billing'),
    __metadata("design:paramtypes", [billing_service_1.BillingService,
        stripe_service_1.StripeService,
        guard_metering_service_1.GuardMeteringService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map