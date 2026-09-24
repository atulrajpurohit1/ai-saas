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
var StripeWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeWebhookController = void 0;
const common_1 = require("@nestjs/common");
const stripe_service_1 = require("./stripe.service");
const stripe_webhook_service_1 = require("./stripe-webhook.service");
let StripeWebhookController = StripeWebhookController_1 = class StripeWebhookController {
    stripe;
    webhooks;
    logger = new common_1.Logger(StripeWebhookController_1.name);
    constructor(stripe, webhooks) {
        this.stripe = stripe;
        this.webhooks = webhooks;
    }
    async handleStripe(req, signature) {
        if (!signature) {
            throw new common_1.BadRequestException('Missing stripe-signature header.');
        }
        if (!req.rawBody) {
            throw new common_1.BadRequestException('Raw request body unavailable.');
        }
        const event = this.stripe.constructEvent(req.rawBody, signature);
        try {
            const result = await this.webhooks.handle(event);
            return { received: true, ...result };
        }
        catch (error) {
            this.logger.error(`Failed handling ${event.type} (${event.id}): ${error instanceof Error ? error.message : 'unknown error'}`);
            throw error;
        }
    }
};
exports.StripeWebhookController = StripeWebhookController;
__decorate([
    (0, common_1.Post)('stripe'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('stripe-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StripeWebhookController.prototype, "handleStripe", null);
exports.StripeWebhookController = StripeWebhookController = StripeWebhookController_1 = __decorate([
    (0, common_1.Controller)('billing/webhook'),
    __metadata("design:paramtypes", [stripe_service_1.StripeService,
        stripe_webhook_service_1.StripeWebhookService])
], StripeWebhookController);
//# sourceMappingURL=stripe-webhook.controller.js.map