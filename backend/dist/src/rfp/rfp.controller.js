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
exports.RfpController = void 0;
const common_1 = require("@nestjs/common");
const rfp_service_1 = require("./rfp.service");
const create_rfp_dto_1 = require("./dto/create-rfp.dto");
const update_rfp_dto_1 = require("./dto/update-rfp.dto");
const assign_vendors_dto_1 = require("./dto/assign-vendors.dto");
const generate_rfp_dto_1 = require("../ai/dto/generate-rfp.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
let RfpController = class RfpController {
    rfpService;
    constructor(rfpService) {
        this.rfpService = rfpService;
    }
    generate(dto) {
        return this.rfpService.generate(dto);
    }
    create(user, dto) {
        return this.rfpService.create(user.tenantId, user.sub, dto);
    }
    findAll(user) {
        return this.rfpService.findAll(user.tenantId);
    }
    findOne(user, id) {
        return this.rfpService.findOne(user.tenantId, id);
    }
    update(user, id, dto) {
        return this.rfpService.update(user.tenantId, user.sub, id, dto);
    }
    remove(user, id) {
        return this.rfpService.remove(user.tenantId, user.sub, id);
    }
    async exportPdf(user, id, res) {
        const buffer = await this.rfpService.exportPdf(user.tenantId, id);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=rfp-${id}.pdf`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    findAssignedVendors(user, id) {
        return this.rfpService.findAssignedVendors(user.tenantId, id);
    }
    assignVendors(user, id, dto) {
        return this.rfpService.assignVendors(user.tenantId, user.sub, id, dto.vendorIds);
    }
    removeVendor(user, id, vendorId) {
        return this.rfpService.removeVendor(user.tenantId, user.sub, id, vendorId);
    }
};
exports.RfpController = RfpController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, permissions_decorator_1.RequirePermission)('rfp.create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generate_rfp_dto_1.GenerateRfpDto]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('rfp.create'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_rfp_dto_1.CreateRfpDto]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermission)('rfp.update'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_rfp_dto_1.UpdateRfpDto]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermission)('rfp.delete'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/pdf'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], RfpController.prototype, "exportPdf", null);
__decorate([
    (0, common_1.Get)(':id/vendors'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "findAssignedVendors", null);
__decorate([
    (0, common_1.Post)(':id/vendors'),
    (0, permissions_decorator_1.RequirePermission)('rfp.update'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, assign_vendors_dto_1.AssignVendorsDto]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "assignVendors", null);
__decorate([
    (0, common_1.Delete)(':id/vendors/:vendorId'),
    (0, permissions_decorator_1.RequirePermission)('rfp.update'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('vendorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], RfpController.prototype, "removeVendor", null);
exports.RfpController = RfpController = __decorate([
    (0, common_1.Controller)('rfp'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('rfp.view'),
    __metadata("design:paramtypes", [rfp_service_1.RfpService])
], RfpController);
//# sourceMappingURL=rfp.controller.js.map