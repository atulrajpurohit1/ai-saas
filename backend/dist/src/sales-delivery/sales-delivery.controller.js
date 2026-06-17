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
exports.SalesDeliveryController = void 0;
const common_1 = require("@nestjs/common");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const sales_delivery_service_1 = require("./sales-delivery.service");
let SalesDeliveryController = class SalesDeliveryController {
    salesDeliveryService;
    constructor(salesDeliveryService) {
        this.salesDeliveryService = salesDeliveryService;
    }
    draftDealFollowUp(dealId, user) {
        return this.salesDeliveryService.draftDealFollowUp(user.tenantId, dealId);
    }
    sendDealFollowUp(dealId, user) {
        return this.salesDeliveryService.sendDealFollowUp(user.tenantId, dealId, user.sub);
    }
    async calendarForDeal(dealId, user, res) {
        const calendar = await this.salesDeliveryService.calendarForDeal(user.tenantId, dealId);
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${calendar.filename}"`);
        res.status(200).send(calendar.content);
    }
};
exports.SalesDeliveryController = SalesDeliveryController;
__decorate([
    (0, common_1.Get)('deals/:dealId/follow-up-draft'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.view'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesDeliveryController.prototype, "draftDealFollowUp", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/send-follow-up'),
    (0, permissions_decorator_1.RequireAnyPermission)('activities.manage', 'deals.update', 'proposals.update'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesDeliveryController.prototype, "sendDealFollowUp", null);
__decorate([
    (0, common_1.Get)('deals/:dealId/calendar.ics'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.view', 'activities.view'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SalesDeliveryController.prototype, "calendarForDeal", null);
exports.SalesDeliveryController = SalesDeliveryController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, common_1.Controller)('sales-delivery'),
    __metadata("design:paramtypes", [sales_delivery_service_1.SalesDeliveryService])
], SalesDeliveryController);
//# sourceMappingURL=sales-delivery.controller.js.map