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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorPortalService = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const file_storage_util_1 = require("../common/file-storage.util");
let VendorPortalService = class VendorPortalService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async findByTokenOrThrow(token) {
        const rfpVendor = await this.prisma.rfpVendor.findUnique({
            where: { invitationToken: token },
            include: { vendor: true, rfp: true, submission: true },
        });
        if (!rfpVendor) {
            throw new common_1.NotFoundException('This invitation link is invalid.');
        }
        return rfpVendor;
    }
    isExpired(dueDate) {
        return Boolean(dueDate && dueDate.getTime() < Date.now());
    }
    async getInvitation(token) {
        const rfpVendor = await this.findByTokenOrThrow(token);
        if (this.isExpired(rfpVendor.rfp.dueDate)) {
            throw new common_1.GoneException('This invitation link has expired.');
        }
        return {
            companyName: rfpVendor.vendor.companyName,
            rfpTitle: rfpVendor.rfp.title,
            industry: rfpVendor.rfp.industry,
            dueDate: rfpVendor.rfp.dueDate,
            additionalRequirements: rfpVendor.rfp.additionalRequirements,
            securityTypes: rfpVendor.rfp.securityTypes,
            invitationStatus: rfpVendor.invitationStatus,
            alreadySubmitted: rfpVendor.invitationStatus === 'SUBMITTED',
        };
    }
    async markViewed(token) {
        const rfpVendor = await this.findByTokenOrThrow(token);
        if (this.isExpired(rfpVendor.rfp.dueDate)) {
            throw new common_1.GoneException('This invitation link has expired.');
        }
        if (rfpVendor.invitationStatus === 'PENDING' ||
            rfpVendor.invitationStatus === 'INVITED') {
            await this.prisma.rfpVendor.update({
                where: { id: rfpVendor.id },
                data: {
                    invitationStatus: 'VIEWED',
                    viewedAt: rfpVendor.viewedAt ?? new Date(),
                },
            });
        }
        return { success: true };
    }
    async submitProposal(token, files, notes) {
        const rfpVendor = await this.findByTokenOrThrow(token);
        if (this.isExpired(rfpVendor.rfp.dueDate)) {
            await this.cleanupUploadedFiles(files);
            throw new common_1.GoneException('This invitation link has expired.');
        }
        if (rfpVendor.invitationStatus === 'SUBMITTED' || rfpVendor.submission) {
            await this.cleanupUploadedFiles(files);
            throw new common_1.ConflictException('A proposal has already been submitted for this invitation.');
        }
        const submission = await this.prisma.proposalSubmission.create({
            data: {
                tenantId: rfpVendor.tenantId,
                rfpVendorId: rfpVendor.id,
                proposalFile: files.proposalFile?.[0]?.filename ?? null,
                pricingFile: files.pricingFile?.[0]?.filename ?? null,
                insuranceFile: files.insuranceFile?.[0]?.filename ?? null,
                licenseFile: files.licenseFile?.[0]?.filename ?? null,
                notes: notes?.trim() || null,
            },
        });
        await this.prisma.rfpVendor.update({
            where: { id: rfpVendor.id },
            data: {
                invitationStatus: 'SUBMITTED',
                submittedAt: new Date(),
            },
        });
        await this.auditService.log({
            tenantId: rfpVendor.tenantId,
            action: 'CREATE',
            entityType: 'ProposalSubmission',
            entityId: submission.id,
            details: `Vendor "${rfpVendor.vendor.companyName}" submitted a proposal for RFP "${rfpVendor.rfp.title}"`,
        });
        return { success: true };
    }
    async cleanupUploadedFiles(files) {
        const all = [
            ...(files.proposalFile ?? []),
            ...(files.pricingFile ?? []),
            ...(files.insuranceFile ?? []),
            ...(files.licenseFile ?? []),
        ];
        await Promise.all(all.map((file) => (0, promises_1.unlink)((0, path_1.join)(file_storage_util_1.VENDOR_UPLOAD_DIR, file.filename)).catch(() => undefined)));
    }
};
exports.VendorPortalService = VendorPortalService;
exports.VendorPortalService = VendorPortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], VendorPortalService);
//# sourceMappingURL=vendor-portal.service.js.map