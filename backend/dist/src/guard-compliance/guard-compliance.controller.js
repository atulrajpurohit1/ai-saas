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
exports.GuardComplianceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const crypto_1 = require("crypto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const file_storage_util_1 = require("../common/file-storage.util");
const guard_compliance_service_1 = require("./guard-compliance.service");
const create_guard_compliance_dto_1 = require("./dto/create-guard-compliance.dto");
const update_guard_compliance_dto_1 = require("./dto/update-guard-compliance.dto");
const complianceFileStorage = (0, multer_1.diskStorage)({
    destination: (_req, _file, callback) => {
        callback(null, (0, file_storage_util_1.ensureGuardComplianceUploadDir)());
    },
    filename: (_req, file, callback) => {
        const unique = `${Date.now()}-${(0, crypto_1.randomBytes)(6).toString('hex')}`;
        callback(null, `${unique}-${(0, file_storage_util_1.sanitizeFilename)(file.originalname)}`);
    },
});
function complianceFileFilter(_req, file, callback) {
    if (!file_storage_util_1.GUARD_COMPLIANCE_UPLOAD_ALLOWED_EXTENSIONS.test(file.originalname)) {
        callback(new common_1.BadRequestException(`Unsupported file type for "${file.originalname}". Allowed types: PDF, JPG, PNG.`), false);
        return;
    }
    callback(null, true);
}
let GuardComplianceController = class GuardComplianceController {
    guardComplianceService;
    constructor(guardComplianceService) {
        this.guardComplianceService = guardComplianceService;
    }
    findAll(user, guardId) {
        return this.guardComplianceService.findAllForTenant(user, guardId);
    }
    create(user, dto) {
        return this.guardComplianceService.create(user, dto);
    }
    update(user, id, dto) {
        return this.guardComplianceService.update(user, id, dto);
    }
    remove(user, id) {
        return this.guardComplianceService.remove(user, id);
    }
    uploadDocument(user, id, file) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        return this.guardComplianceService.attachDocument(user, id, file);
    }
    async downloadDocument(user, id, res) {
        const { stream, filename } = await this.guardComplianceService.getDocumentForDownload(user, id);
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
        });
        stream.pipe(res);
    }
};
exports.GuardComplianceController = GuardComplianceController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('guard_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuardComplianceController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('guards.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_guard_compliance_dto_1.CreateGuardComplianceDto]),
    __metadata("design:returntype", void 0)
], GuardComplianceController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, permissions_decorator_1.RequirePermission)('guards.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_guard_compliance_dto_1.UpdateGuardComplianceDto]),
    __metadata("design:returntype", void 0)
], GuardComplianceController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermission)('guards.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuardComplianceController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/document'),
    (0, permissions_decorator_1.RequirePermission)('guards.manage'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: complianceFileStorage,
        fileFilter: complianceFileFilter,
        limits: { fileSize: (0, file_storage_util_1.guardComplianceUploadMaxBytes)() },
    })),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], GuardComplianceController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Get)(':id/document'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], GuardComplianceController.prototype, "downloadDocument", null);
exports.GuardComplianceController = GuardComplianceController = __decorate([
    (0, common_1.Controller)('guard-compliance'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('guards.view'),
    __metadata("design:paramtypes", [guard_compliance_service_1.GuardComplianceService])
], GuardComplianceController);
//# sourceMappingURL=guard-compliance.controller.js.map