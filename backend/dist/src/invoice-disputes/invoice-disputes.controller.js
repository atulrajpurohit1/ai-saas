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
exports.InvoiceDisputesController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const respond_invoice_dispute_dto_1 = require("./dto/respond-invoice-dispute.dto");
const invoice_disputes_service_1 = require("./invoice-disputes.service");
let InvoiceDisputesController = class InvoiceDisputesController {
    invoiceDisputesService;
    constructor(invoiceDisputesService) {
        this.invoiceDisputesService = invoiceDisputesService;
    }
    findAll(user) {
        return this.invoiceDisputesService.findAll(user.tenantId);
    }
    findOne(user, id) {
        return this.invoiceDisputesService.findOne(user.tenantId, user.sub, id);
    }
    respond(user, id, dto) {
        return this.invoiceDisputesService.respond(user.tenantId, user.sub, id, dto);
    }
    resolve(user, id, dto) {
        return this.invoiceDisputesService.resolve(user.tenantId, user.sub, id, dto);
    }
    reject(user, id, dto) {
        return this.invoiceDisputesService.reject(user.tenantId, user.sub, id, dto);
    }
};
exports.InvoiceDisputesController = InvoiceDisputesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InvoiceDisputesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InvoiceDisputesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/respond'),
    (0, permissions_decorator_1.RequirePermission)('invoice_disputes.respond'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, respond_invoice_dispute_dto_1.RespondInvoiceDisputeDto]),
    __metadata("design:returntype", void 0)
], InvoiceDisputesController.prototype, "respond", null);
__decorate([
    (0, common_1.Post)(':id/resolve'),
    (0, permissions_decorator_1.RequirePermission)('invoice_disputes.respond'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, respond_invoice_dispute_dto_1.CloseInvoiceDisputeDto]),
    __metadata("design:returntype", void 0)
], InvoiceDisputesController.prototype, "resolve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, permissions_decorator_1.RequirePermission)('invoice_disputes.respond'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, respond_invoice_dispute_dto_1.CloseInvoiceDisputeDto]),
    __metadata("design:returntype", void 0)
], InvoiceDisputesController.prototype, "reject", null);
exports.InvoiceDisputesController = InvoiceDisputesController = __decorate([
    (0, common_1.Controller)('invoice-disputes'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('invoice_disputes.view'),
    __metadata("design:paramtypes", [invoice_disputes_service_1.InvoiceDisputesService])
], InvoiceDisputesController);
//# sourceMappingURL=invoice-disputes.controller.js.map