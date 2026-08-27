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
exports.GuardComplianceService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const branch_scope_1 = require("../branches/branch-scope");
const file_storage_util_1 = require("../common/file-storage.util");
const compliance_types_constants_1 = require("./compliance-types.constants");
const compliance_status_util_1 = require("./compliance-status.util");
let GuardComplianceService = class GuardComplianceService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async findGuardOrThrow(user, guardId) {
        const guard = await this.prisma.guard.findFirst({
            where: { id: guardId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        return guard;
    }
    async findRecordOrThrow(user, id) {
        const record = await this.prisma.guardCompliance.findFirst({
            where: { id, tenantId: user.tenantId, guard: { ...(0, branch_scope_1.branchWhere)(user) } },
            include: { guard: { select: { id: true, name: true } } },
        });
        if (!record) {
            throw new common_1.NotFoundException('Compliance record not found');
        }
        return record;
    }
    assertDateOrder(issueDate, expirationDate) {
        if (issueDate &&
            expirationDate &&
            expirationDate.getTime() < issueDate.getTime()) {
            throw new common_1.BadRequestException('Expiration date cannot be before issue date');
        }
    }
    statusOf(expirationDate) {
        try {
            return (0, compliance_status_util_1.calculateRecordStatus)(expirationDate);
        }
        catch {
            return compliance_status_util_1.ComplianceStatus.EXPIRED;
        }
    }
    serialize(record, guardName) {
        return {
            id: record.id,
            guardId: record.guardId,
            guardName,
            type: record.type,
            status: this.statusOf(record.expirationDate),
            documentNumber: record.documentNumber,
            issuingAuthority: record.issuingAuthority,
            issueDate: record.issueDate,
            expirationDate: record.expirationDate,
            notes: record.notes,
            hasDocument: Boolean(record.storedFileName),
            fileName: record.fileName,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
    async create(user, dto) {
        const guard = await this.findGuardOrThrow(user, dto.guard_id);
        const issueDate = dto.issue_date ? new Date(dto.issue_date) : null;
        const expirationDate = dto.expiration_date
            ? new Date(dto.expiration_date)
            : null;
        this.assertDateOrder(issueDate, expirationDate);
        const record = await this.prisma.guardCompliance.create({
            data: {
                tenantId: user.tenantId,
                guardId: guard.id,
                type: dto.type,
                documentNumber: dto.document_number || null,
                issuingAuthority: dto.issuing_authority || null,
                issueDate,
                expirationDate,
                notes: dto.notes || null,
                createdBy: user.sub,
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_COMPLIANCE_CREATED',
            entityType: 'GuardCompliance',
            entityId: record.id,
            details: `Added ${dto.type} compliance record for guard "${guard.name}"`,
        });
        return this.serialize(record, guard.name);
    }
    async update(user, id, dto) {
        const record = await this.findRecordOrThrow(user, id);
        const nextIssue = dto.issue_date !== undefined
            ? dto.issue_date
                ? new Date(dto.issue_date)
                : null
            : record.issueDate;
        const nextExpiration = dto.expiration_date !== undefined
            ? dto.expiration_date
                ? new Date(dto.expiration_date)
                : null
            : record.expirationDate;
        this.assertDateOrder(nextIssue, nextExpiration);
        const updated = await this.prisma.guardCompliance.update({
            where: { id },
            data: {
                ...(dto.type !== undefined ? { type: dto.type } : {}),
                ...(dto.document_number !== undefined
                    ? { documentNumber: dto.document_number || null }
                    : {}),
                ...(dto.issuing_authority !== undefined
                    ? { issuingAuthority: dto.issuing_authority || null }
                    : {}),
                ...(dto.issue_date !== undefined ? { issueDate: nextIssue } : {}),
                ...(dto.expiration_date !== undefined
                    ? { expirationDate: nextExpiration }
                    : {}),
                ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_COMPLIANCE_UPDATED',
            entityType: 'GuardCompliance',
            entityId: record.id,
            details: `Updated compliance record for guard "${record.guard.name}"`,
        });
        return this.serialize(updated, record.guard.name);
    }
    async remove(user, id) {
        const record = await this.findRecordOrThrow(user, id);
        if (record.storedFileName) {
            const filePath = (0, path_1.join)(file_storage_util_1.GUARD_COMPLIANCE_UPLOAD_DIR, record.storedFileName);
            if ((0, fs_1.existsSync)(filePath))
                (0, fs_1.unlinkSync)(filePath);
        }
        await this.prisma.guardCompliance.delete({ where: { id } });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_COMPLIANCE_DELETED',
            entityType: 'GuardCompliance',
            entityId: id,
            details: `Removed ${record.type} compliance record for guard "${record.guard.name}"`,
        });
        return { success: true };
    }
    async findAllForTenant(user, guardId) {
        const guards = await this.prisma.guard.findMany({
            where: {
                tenantId: user.tenantId,
                ...(0, branch_scope_1.branchWhere)(user),
                ...(guardId ? { id: guardId } : {}),
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        const guardIds = guards.map((g) => g.id);
        if (guardIds.length === 0)
            return [];
        const records = await this.prisma.guardCompliance.findMany({
            where: { tenantId: user.tenantId, guardId: { in: guardIds } },
            orderBy: { createdAt: 'desc' },
        });
        const guardNameById = new Map(guards.map((g) => [g.id, g.name]));
        const seenGuardType = new Set();
        const results = records.map((record) => {
            seenGuardType.add(`${record.guardId}:${record.type}`);
            return this.serialize(record, guardNameById.get(record.guardId) || 'Unknown Guard');
        });
        for (const guard of guards) {
            for (const type of compliance_types_constants_1.GUARD_COMPLIANCE_TYPES) {
                if (!seenGuardType.has(`${guard.id}:${type}`)) {
                    results.push({
                        id: null,
                        guardId: guard.id,
                        guardName: guard.name,
                        type,
                        status: compliance_status_util_1.ComplianceStatus.MISSING,
                        documentNumber: null,
                        issuingAuthority: null,
                        issueDate: null,
                        expirationDate: null,
                        notes: null,
                        hasDocument: false,
                        fileName: null,
                        createdAt: null,
                        updatedAt: null,
                    });
                }
            }
        }
        return results;
    }
    async attachDocument(user, id, file) {
        const record = await this.findRecordOrThrow(user, id);
        if (record.storedFileName) {
            const oldPath = (0, path_1.join)(file_storage_util_1.GUARD_COMPLIANCE_UPLOAD_DIR, record.storedFileName);
            if ((0, fs_1.existsSync)(oldPath))
                (0, fs_1.unlinkSync)(oldPath);
        }
        const updated = await this.prisma.guardCompliance.update({
            where: { id },
            data: { fileName: file.originalname, storedFileName: file.filename },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_COMPLIANCE_DOCUMENT_UPLOADED',
            entityType: 'GuardCompliance',
            entityId: record.id,
            details: `Uploaded document for ${record.type} compliance record - guard "${record.guard.name}"`,
        });
        return this.serialize(updated, record.guard.name);
    }
    async getDocumentForDownload(user, id) {
        const record = await this.findRecordOrThrow(user, id);
        if (!record.storedFileName) {
            throw new common_1.NotFoundException('No document uploaded for this record');
        }
        const filePath = (0, path_1.join)(file_storage_util_1.GUARD_COMPLIANCE_UPLOAD_DIR, record.storedFileName);
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new common_1.NotFoundException('File not found on server');
        }
        return {
            stream: (0, fs_1.createReadStream)(filePath),
            filename: record.fileName || record.storedFileName,
        };
    }
};
exports.GuardComplianceService = GuardComplianceService;
exports.GuardComplianceService = GuardComplianceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], GuardComplianceService);
//# sourceMappingURL=guard-compliance.service.js.map