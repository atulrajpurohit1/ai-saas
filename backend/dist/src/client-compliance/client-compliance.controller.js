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
exports.ClientComplianceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const crypto_1 = require("crypto");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const file_storage_util_1 = require("../common/file-storage.util");
const client_compliance_service_1 = require("./client-compliance.service");
const create_client_insurance_policy_dto_1 = require("./dto/create-client-insurance-policy.dto");
const update_client_insurance_policy_dto_1 = require("./dto/update-client-insurance-policy.dto");
const insuranceFileStorage = (0, multer_1.diskStorage)({
    destination: (_req, _file, callback) => {
        callback(null, (0, file_storage_util_1.ensureClientInsuranceUploadDir)());
    },
    filename: (_req, file, callback) => {
        const unique = `${Date.now()}-${(0, crypto_1.randomBytes)(6).toString('hex')}`;
        callback(null, `${unique}-${(0, file_storage_util_1.sanitizeFilename)(file.originalname)}`);
    },
});
function insuranceFileFilter(_req, file, callback) {
    if (!file_storage_util_1.CLIENT_INSURANCE_UPLOAD_ALLOWED_EXTENSIONS.test(file.originalname)) {
        callback(new common_1.BadRequestException(`Unsupported file type for "${file.originalname}". Allowed: PDF, JPG, PNG, WEBP.`), false);
        return;
    }
    callback(null, true);
}
let ClientComplianceController = class ClientComplianceController {
    clientComplianceService;
    constructor(clientComplianceService) {
        this.clientComplianceService = clientComplianceService;
    }
    findAll(user, clientId, siteId, status, type) {
        return this.clientComplianceService.findAll(user, {
            clientId: clientId?.trim() || undefined,
            siteId: siteId?.trim() || undefined,
            status: status?.trim() || undefined,
            type: type?.trim() || undefined,
        });
    }
    getSummary(user, clientId) {
        return this.clientComplianceService.getSummary(user, clientId?.trim() || undefined);
    }
    create(user, dto) {
        return this.clientComplianceService.create(user, dto);
    }
    update(user, id, dto) {
        return this.clientComplianceService.update(user, id, dto);
    }
    remove(user, id) {
        return this.clientComplianceService.remove(user, id);
    }
    uploadDocument(user, id, file) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        return this.clientComplianceService.attachDocument(user, id, file);
    }
    async downloadDocument(user, id, res) {
        const { stream, filename } = await this.clientComplianceService.getDocumentForDownload(user, id);
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Cache-Control': 'private, no-store',
        });
        stream.pipe(res);
    }
};
exports.ClientComplianceController = ClientComplianceController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermission)('clients.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('client_id')),
    __param(2, (0, common_1.Query)('site_id')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], ClientComplianceController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, permissions_decorator_1.RequireAnyPermission)('clients.view', 'finance.view', 'invoices.generate'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('client_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientComplianceController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('clients.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_client_insurance_policy_dto_1.CreateClientInsurancePolicyDto]),
    __metadata("design:returntype", void 0)
], ClientComplianceController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, permissions_decorator_1.RequirePermission)('clients.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_client_insurance_policy_dto_1.UpdateClientInsurancePolicyDto]),
    __metadata("design:returntype", void 0)
], ClientComplianceController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermission)('clients.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientComplianceController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/document'),
    (0, permissions_decorator_1.RequirePermission)('clients.manage'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: insuranceFileStorage,
        fileFilter: insuranceFileFilter,
        limits: { fileSize: (0, file_storage_util_1.clientInsuranceUploadMaxBytes)() },
    })),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClientComplianceController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Get)(':id/document'),
    (0, permissions_decorator_1.RequirePermission)('clients.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClientComplianceController.prototype, "downloadDocument", null);
exports.ClientComplianceController = ClientComplianceController = __decorate([
    (0, common_1.Controller)('client-compliance'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [client_compliance_service_1.ClientComplianceService])
], ClientComplianceController);
//# sourceMappingURL=client-compliance.controller.js.map