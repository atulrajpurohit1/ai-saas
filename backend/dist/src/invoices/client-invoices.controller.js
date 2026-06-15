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
exports.ClientInvoicesController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const dispute_invoice_dto_1 = require("./dto/dispute-invoice.dto");
const invoices_service_1 = require("./invoices.service");
let ClientInvoicesController = class ClientInvoicesController {
    invoicesService;
    constructor(invoicesService) {
        this.invoicesService = invoicesService;
    }
    getClientContext(user) {
        if (user.role !== 'client' || !user.clientId || !user.tenantId) {
            throw new common_1.ForbiddenException('Client access required');
        }
        return {
            tenantId: user.tenantId,
            clientId: user.clientId,
            userId: user.sub,
        };
    }
    findAll(user) {
        const { tenantId, clientId } = this.getClientContext(user);
        return this.invoicesService.findAllForClient(tenantId, clientId);
    }
    async download(user, id, res) {
        const { tenantId, clientId, userId } = this.getClientContext(user);
        const { buffer, invoice } = await this.invoicesService.downloadForClient(tenantId, clientId, userId, id);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=${invoice.invoiceNumber}.pdf`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    findOne(user, id) {
        const { tenantId, clientId } = this.getClientContext(user);
        return this.invoicesService.findOneForClient(tenantId, clientId, id);
    }
    accept(user, id) {
        const { tenantId, clientId, userId } = this.getClientContext(user);
        return this.invoicesService.acceptInvoice(tenantId, clientId, userId, id);
    }
    dispute(user, id, dto) {
        const { tenantId, clientId, userId } = this.getClientContext(user);
        return this.invoicesService.disputeInvoice(tenantId, clientId, userId, id, dto);
    }
    async getDispute(user, id) {
        const { tenantId, clientId } = this.getClientContext(user);
        return this.invoicesService.getDisputeForClient(tenantId, clientId, id);
    }
};
exports.ClientInvoicesController = ClientInvoicesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientInvoicesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClientInvoicesController.prototype, "download", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientInvoicesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/accept'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientInvoicesController.prototype, "accept", null);
__decorate([
    (0, common_1.Post)(':id/dispute'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dispute_invoice_dto_1.DisputeInvoiceDto]),
    __metadata("design:returntype", void 0)
], ClientInvoicesController.prototype, "dispute", null);
__decorate([
    (0, common_1.Get)(':id/dispute'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClientInvoicesController.prototype, "getDispute", null);
exports.ClientInvoicesController = ClientInvoicesController = __decorate([
    (0, common_1.Controller)('client/invoices'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('client'),
    __metadata("design:paramtypes", [invoices_service_1.InvoicesService])
], ClientInvoicesController);
//# sourceMappingURL=client-invoices.controller.js.map