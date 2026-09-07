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
exports.GuardIncidentsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const crypto_1 = require("crypto");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const file_storage_util_1 = require("../common/file-storage.util");
const create_incident_dto_1 = require("./dto/create-incident.dto");
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
let GuardIncidentsController = class GuardIncidentsController {
    incidentsService;
    constructor(incidentsService) {
        this.incidentsService = incidentsService;
    }
    getGuardContext(user) {
        if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
            throw new common_1.ForbiddenException('Guard access required');
        }
        return {
            tenantId: user.tenantId,
            guardId: user.guardId,
        };
    }
    createForShift(user, shiftId, dto) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.incidentsService.createForGuard(tenantId, guardId, shiftId, dto);
    }
    findMine(user) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.incidentsService.findForGuard(tenantId, guardId);
    }
    uploadEvidence(user, id, file) {
        const { tenantId, guardId } = this.getGuardContext(user);
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        return this.incidentsService.addEvidenceForGuard(tenantId, guardId, id, file);
    }
    listEvidence(user, id) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.incidentsService.listEvidenceForGuard(tenantId, guardId, id);
    }
    async downloadEvidence(user, id, evidenceId, res) {
        const { tenantId, guardId } = this.getGuardContext(user);
        const { stream, mimeType, fileName, fileSizeBytes } = await this.incidentsService.getEvidenceFileForGuard(tenantId, guardId, id, evidenceId);
        res.set({
            'Content-Type': mimeType || 'application/octet-stream',
            'Content-Length': String(fileSizeBytes),
            'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
            'Cache-Control': 'private, no-store',
        });
        stream.pipe(res);
    }
};
exports.GuardIncidentsController = GuardIncidentsController;
__decorate([
    (0, common_1.Post)('shifts/:id/incidents'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_incident_dto_1.CreateIncidentDto]),
    __metadata("design:returntype", void 0)
], GuardIncidentsController.prototype, "createForShift", null);
__decorate([
    (0, common_1.Get)('incidents'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuardIncidentsController.prototype, "findMine", null);
__decorate([
    (0, common_1.Post)('incidents/:id/evidence'),
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
], GuardIncidentsController.prototype, "uploadEvidence", null);
__decorate([
    (0, common_1.Get)('incidents/:id/evidence'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuardIncidentsController.prototype, "listEvidence", null);
__decorate([
    (0, common_1.Get)('incidents/:id/evidence/:evidenceId/file'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('evidenceId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], GuardIncidentsController.prototype, "downloadEvidence", null);
exports.GuardIncidentsController = GuardIncidentsController = __decorate([
    (0, common_1.Controller)('guard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('guard'),
    __metadata("design:paramtypes", [incidents_service_1.IncidentsService])
], GuardIncidentsController);
//# sourceMappingURL=guard-incidents.controller.js.map