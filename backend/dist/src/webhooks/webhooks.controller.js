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
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const create_webhook_dto_1 = require("./dto/create-webhook.dto");
const update_webhook_dto_1 = require("./dto/update-webhook.dto");
const webhooks_service_1 = require("./webhooks.service");
let WebhooksController = class WebhooksController {
    webhooksService;
    constructor(webhooksService) {
        this.webhooksService = webhooksService;
    }
    listEvents() {
        return this.webhooksService.listEvents();
    }
    list(user) {
        return this.webhooksService.list(user);
    }
    create(user, dto) {
        return this.webhooksService.create(user, dto);
    }
    update(user, id, dto) {
        return this.webhooksService.update(user, id, dto);
    }
    revoke(user, id) {
        return this.webhooksService.revoke(user, id);
    }
    rotateSecret(user, id) {
        return this.webhooksService.rotateSecret(user, id);
    }
    listDeliveries(user, webhookId) {
        return this.webhooksService.listDeliveries(user, webhookId);
    }
    retryDelivery(user, id) {
        return this.webhooksService.retryDelivery(user, id);
    }
    retryFailed(user) {
        return this.webhooksService.retryFailed(user);
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, common_1.Get)('events'),
    (0, permissions_decorator_1.RequireAnyPermission)('webhooks.view', 'webhooks.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "listEvents", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermission)('webhooks.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('webhooks.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_webhook_dto_1.CreateWebhookDto]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermission)('webhooks.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_webhook_dto_1.UpdateWebhookDto]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/revoke'),
    (0, permissions_decorator_1.RequirePermission)('webhooks.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "revoke", null);
__decorate([
    (0, common_1.Post)(':id/rotate-secret'),
    (0, permissions_decorator_1.RequirePermission)('webhooks.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "rotateSecret", null);
__decorate([
    (0, common_1.Get)('deliveries'),
    (0, permissions_decorator_1.RequirePermission)('webhooks.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('webhook_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "listDeliveries", null);
__decorate([
    (0, common_1.Post)('deliveries/:id/retry'),
    (0, permissions_decorator_1.RequirePermission)('webhooks.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "retryDelivery", null);
__decorate([
    (0, common_1.Post)('deliveries/retry-failed'),
    (0, permissions_decorator_1.RequirePermission)('webhooks.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "retryFailed", null);
exports.WebhooksController = WebhooksController = __decorate([
    (0, common_1.Controller)('webhooks'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [webhooks_service_1.WebhooksService])
], WebhooksController);
//# sourceMappingURL=webhooks.controller.js.map