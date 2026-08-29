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
exports.IncidentsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const crypto_1 = require("crypto");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const file_storage_util_1 = require("../common/file-storage.util");
const review_incident_dto_1 = require("./dto/review-incident.dto");
const incidents_service_1 = require("./incidents.service");
const evidenceFileStorage = (0, multer_1.diskStorage)({
    destination: (_req, _file, callback) => {
        callback(null, (0, file_storage_util_1.ensureIncidentEvidenceUploadDir)());
    },
    filename: (_req, file, callback) => {
        const unique = `${Date.now()}-${(0, crypto_1.randomBytes)(6).toString('hex')}`;
        callback(null, `${unique}-${(0, file_storage_util_1.sanitizeFilename)(file.originalname)}`);
    },
});
function evidenceFileFilter(_req, file, callback) {
    if (!file_storage_util_1.INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS.test(file.originalname)) {
        callback(new common_1.BadRequestException(`Unsupported file type for "${file.originalname}". Allowed: JPG, PNG, WEBP, GIF, HEIC, MP4, MOV, M4V, WEBM.`), false);
        return;
    }
    callback(null, true);
}
let IncidentsController = class IncidentsController {
    incidentsService;
    constructor(incidentsService) {
        this.incidentsService = incidentsService;
    }
    findAll(user, branchId) {
        return this.incidentsService.findAllForAdmin(user, branchId);
    }
    findReviewQueue(user, branchId) {
        return this.incidentsService.findReviewQueueForAdmin(user, branchId);
    }
    findOne(user, id) {
        return this.incidentsService.findOneForAdmin(user, id);
    }
    review(user, id, dto) {
        return this.incidentsService.reviewIncident(user, id, dto);
    }
    listEvidence(user, id) {
        return this.incidentsService.listEvidenceForAdmin(user, id);
    }
    uploadEvidence(user, id, file) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        return this.incidentsService.addEvidenceForAdmin(user, id, file);
    }
    async downloadEvidence(user, id, evidenceId, res) {
        const { stream, mimeType, fileName, fileSizeBytes } = await this.incidentsService.getEvidenceFileForAdmin(user, id, evidenceId);
        res.set({
            'Content-Type': mimeType || 'application/octet-stream',
            'Content-Length': String(fileSizeBytes),
            'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
            'Cache-Control': 'private, no-store',
        });
        stream.pipe(res);
    }
    deleteEvidence(user, id, evidenceId) {
        return this.incidentsService.deleteEvidenceForAdmin(user, id, evidenceId);
    }
};
exports.IncidentsController = IncidentsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('branch_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('review-queue'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('branch_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "findReviewQueue", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/review'),
    (0, permissions_decorator_1.RequirePermission)('incidents.review'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, review_incident_dto_1.ReviewIncidentDto]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "review", null);
__decorate([
    (0, common_1.Get)(':id/evidence'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "listEvidence", null);
__decorate([
    (0, common_1.Post)(':id/evidence'),
    (0, permissions_decorator_1.RequirePermission)('incidents.review'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: evidenceFileStorage,
        fileFilter: evidenceFileFilter,
        limits: { fileSize: (0, file_storage_util_1.incidentEvidenceUploadMaxBytes)() },
    })),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "uploadEvidence", null);
__decorate([
    (0, common_1.Get)(':id/evidence/:evidenceId/file'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('evidenceId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], IncidentsController.prototype, "downloadEvidence", null);
__decorate([
    (0, common_1.Delete)(':id/evidence/:evidenceId'),
    (0, permissions_decorator_1.RequirePermission)('incidents.review'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('evidenceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "deleteEvidence", null);
exports.IncidentsController = IncidentsController = __decorate([
    (0, common_1.Controller)('incidents'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('incidents.view'),
    __metadata("design:paramtypes", [incidents_service_1.IncidentsService])
], IncidentsController);
//# sourceMappingURL=incidents.controller.js.map