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
exports.VendorPortalController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const crypto_1 = require("crypto");
const file_storage_util_1 = require("../common/file-storage.util");
const submit_proposal_dto_1 = require("./dto/submit-proposal.dto");
const vendor_portal_service_1 = require("./vendor-portal.service");
const submissionFileStorage = (0, multer_1.diskStorage)({
    destination: (_req, _file, callback) => {
        callback(null, (0, file_storage_util_1.ensureVendorUploadDir)());
    },
    filename: (_req, file, callback) => {
        const unique = `${Date.now()}-${(0, crypto_1.randomBytes)(6).toString('hex')}`;
        callback(null, `${unique}-${(0, file_storage_util_1.sanitizeFilename)(file.originalname)}`);
    },
});
function submissionFileFilter(_req, file, callback) {
    if (!file_storage_util_1.VENDOR_UPLOAD_ALLOWED_EXTENSIONS.test(file.originalname)) {
        callback(new common_1.BadRequestException(`Unsupported file type for "${file.originalname}". Allowed types: PDF, DOCX, XLSX, ZIP.`), false);
        return;
    }
    callback(null, true);
}
let VendorPortalController = class VendorPortalController {
    vendorPortalService;
    constructor(vendorPortalService) {
        this.vendorPortalService = vendorPortalService;
    }
    getInvitation(token) {
        return this.vendorPortalService.getInvitation(token);
    }
    markViewed(token) {
        return this.vendorPortalService.markViewed(token);
    }
    submitProposal(token, files, dto) {
        return this.vendorPortalService.submitProposal(token, files ?? {}, dto.notes);
    }
};
exports.VendorPortalController = VendorPortalController;
__decorate([
    (0, common_1.Get)(':token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VendorPortalController.prototype, "getInvitation", null);
__decorate([
    (0, common_1.Post)(':token/view'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VendorPortalController.prototype, "markViewed", null);
__decorate([
    (0, common_1.Post)(':token/submit'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'proposalFile', maxCount: 1 },
        { name: 'pricingFile', maxCount: 1 },
        { name: 'insuranceFile', maxCount: 1 },
        { name: 'licenseFile', maxCount: 1 },
    ], {
        storage: submissionFileStorage,
        fileFilter: submissionFileFilter,
        limits: { fileSize: (0, file_storage_util_1.vendorUploadMaxBytes)() },
    })),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, submit_proposal_dto_1.SubmitProposalDto]),
    __metadata("design:returntype", void 0)
], VendorPortalController.prototype, "submitProposal", null);
exports.VendorPortalController = VendorPortalController = __decorate([
    (0, common_1.Controller)('vendor/invitation'),
    __metadata("design:paramtypes", [vendor_portal_service_1.VendorPortalService])
], VendorPortalController);
//# sourceMappingURL=vendor-portal.controller.js.map