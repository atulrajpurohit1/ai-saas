"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_module_1 = require("../audit/audit.module");
const billing_controller_1 = require("./billing.controller");
const billing_service_1 = require("./billing.service");
const stripe_service_1 = require("./stripe.service");
const stripe_webhook_service_1 = require("./stripe-webhook.service");
const stripe_webhook_controller_1 = require("./stripe-webhook.controller");
const subscription_provisioning_service_1 = require("./subscription-provisioning.service");
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule],
        controllers: [billing_controller_1.BillingController, stripe_webhook_controller_1.StripeWebhookController],
        providers: [
            billing_service_1.BillingService,
            stripe_service_1.StripeService,
            stripe_webhook_service_1.StripeWebhookService,
            subscription_provisioning_service_1.SubscriptionProvisioningService,
        ],
        exports: [billing_service_1.BillingService, subscription_provisioning_service_1.SubscriptionProvisioningService],
    })
], BillingModule);
//# sourceMappingURL=billing.module.js.map