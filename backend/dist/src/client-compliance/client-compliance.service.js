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
exports.ClientComplianceService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const branch_scope_1 = require("../branches/branch-scope");
const file_storage_util_1 = require("../common/file-storage.util");
const compliance_status_util_1 = require("../guard-compliance/compliance-status.util");
const client_insurance_types_constants_1 = require("./client-insurance-types.constants");
let ClientComplianceService = class ClientComplianceService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async findClientInScopeOrThrow(user, clientId) {
        const client = await this.prisma.client.findFirst({
            where: { id: clientId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            select: { id: true, name: true },
        });
        if (!client) {
            throw new common_1.NotFoundException('Client not found');
        }
        return client;
    }
    async assertSiteBelongsToClient(user, clientId, siteId) {
        const site = await this.prisma.site.findFirst({
            where: {
                id: siteId,
                tenantId: user.tenantId,
                clientId,
                ...(0, branch_scope_1.branchWhere)(user),
            },
            select: { id: true },
        });
        if (!site) {
            throw new common_1.BadRequestException('Selected site does not belong to this client');
        }
    }
    async findRecordInScopeOrThrow(user, id) {
        const record = await this.prisma.clientInsurancePolicy.findFirst({
            where: {
                id,
                tenantId: user.tenantId,
                client: { ...(0, branch_scope_1.branchWhere)(user) },
            },
            include: { client: { select: { id: true, name: true } } },
        });
        if (!record) {
            throw new common_1.NotFoundException('Insurance policy not found');
        }
        return record;
    }
    statusOf(expirationDate) {
        try {
            return (0, compliance_status_util_1.calculateRecordStatus)(expirationDate);
        }
        catch {
            return compliance_status_util_1.ComplianceStatus.EXPIRED;
        }
    }
    assertDateOrder(effectiveDate, expirationDate) {
        if (effectiveDate &&
            expirationDate &&
            expirationDate.getTime() < effectiveDate.getTime()) {
            throw new common_1.BadRequestException('Expiration date cannot be before the effective date');
        }
    }
    serialize(record, clientName, siteName) {
        return {
            id: record.id,
            clientId: record.clientId,
            clientName,
            siteId: record.siteId,
            siteName: siteName ?? null,
            scope: record.siteId ? 'site' : 'client_wide',
            type: record.type,
            status: this.statusOf(record.expirationDate),
            policyNumber: record.policyNumber,
            insurer: record.insurer,
            coverageAmount: record.coverageAmount,
            effectiveDate: record.effectiveDate,
            expirationDate: record.expirationDate,
            notes: record.notes,
            hasDocument: Boolean(record.storedFileName),
            fileName: record.fileName,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
    unlinkQuietly(storedFileName) {
        try {
            const filePath = (0, path_1.join)(file_storage_util_1.CLIENT_INSURANCE_UPLOAD_DIR, storedFileName);
            if ((0, fs_1.existsSync)(filePath))
                (0, fs_1.unlinkSync)(filePath);
        }
        catch {
        }
    }
    async create(user, dto) {
        const client = await this.findClientInScopeOrThrow(user, dto.client_id);
        const siteId = dto.site_id?.trim() || null;
        if (siteId) {
            await this.assertSiteBelongsToClient(user, client.id, siteId);
        }
        const effectiveDate = dto.effective_date
            ? new Date(dto.effective_date)
            : null;
        const expirationDate = dto.expiration_date
            ? new Date(dto.expiration_date)
            : null;
        this.assertDateOrder(effectiveDate, expirationDate);
        const record = await this.prisma.clientInsurancePolicy.create({
            data: {
                tenantId: user.tenantId,
                clientId: client.id,
                siteId,
                type: dto.type,
                policyNumber: dto.policy_number?.trim() || null,
                insurer: dto.insurer?.trim() || null,
                coverageAmount: typeof dto.coverage_amount === 'number' ? dto.coverage_amount : null,
                effectiveDate,
                expirationDate,
                notes: dto.notes?.trim() || null,
                createdBy: user.sub,
            },
            include: { site: { select: { name: true } } },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CLIENT_INSURANCE_POLICY_CREATED',
            entityType: 'ClientInsurancePolicy',
            entityId: record.id,
            details: `Added ${dto.type} insurance policy for client "${client.name}"`,
        });
        return this.serialize(record, client.name, record.site?.name);
    }
    async update(user, id, dto) {
        const record = await this.findRecordInScopeOrThrow(user, id);
        let nextSiteId = record.siteId;
        if (dto.site_id !== undefined) {
            nextSiteId = dto.site_id?.trim() || null;
            if (nextSiteId) {
                await this.assertSiteBelongsToClient(user, record.clientId, nextSiteId);
            }
        }
        const nextEffective = dto.effective_date !== undefined
            ? dto.effective_date
                ? new Date(dto.effective_date)
                : null
            : record.effectiveDate;
        const nextExpiration = dto.expiration_date !== undefined
            ? dto.expiration_date
                ? new Date(dto.expiration_date)
                : null
            : record.expirationDate;
        this.assertDateOrder(nextEffective, nextExpiration);
        const updated = await this.prisma.clientInsurancePolicy.update({
            where: { id },
            data: {
                ...(dto.site_id !== undefined ? { siteId: nextSiteId } : {}),
                ...(dto.type !== undefined ? { type: dto.type } : {}),
                ...(dto.policy_number !== undefined
                    ? { policyNumber: dto.policy_number?.trim() || null }
                    : {}),
                ...(dto.insurer !== undefined
                    ? { insurer: dto.insurer?.trim() || null }
                    : {}),
                ...(dto.coverage_amount !== undefined
                    ? {
                        coverageAmount: typeof dto.coverage_amount === 'number'
                            ? dto.coverage_amount
                            : null,
                    }
                    : {}),
                ...(dto.effective_date !== undefined
                    ? { effectiveDate: nextEffective }
                    : {}),
                ...(dto.expiration_date !== undefined
                    ? { expirationDate: nextExpiration }
                    : {}),
                ...(dto.notes !== undefined
                    ? { notes: dto.notes?.trim() || null }
                    : {}),
            },
            include: { site: { select: { name: true } } },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CLIENT_INSURANCE_POLICY_UPDATED',
            entityType: 'ClientInsurancePolicy',
            entityId: record.id,
            details: `Updated insurance policy for client "${record.client.name}"`,
        });
        return this.serialize(updated, record.client.name, updated.site?.name);
    }
    async remove(user, id) {
        const record = await this.findRecordInScopeOrThrow(user, id);
        if (record.storedFileName) {
            this.unlinkQuietly(record.storedFileName);
        }
        await this.prisma.clientInsurancePolicy.delete({ where: { id } });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CLIENT_INSURANCE_POLICY_DELETED',
            entityType: 'ClientInsurancePolicy',
            entityId: id,
            details: `Removed ${record.type} insurance policy for client "${record.client.name}"`,
        });
        return { success: true };
    }
    async attachDocument(user, id, file) {
        const record = await this.findRecordInScopeOrThrow(user, id);
        if (!(0, file_storage_util_1.isAllowedClientInsuranceDocument)(file.originalname, file.mimetype)) {
            this.unlinkQuietly(file.filename);
            throw new common_1.BadRequestException('Unsupported file. Only PDF, JPG, PNG, or WEBP insurance documents are allowed.');
        }
        if (file.size > (0, file_storage_util_1.clientInsuranceUploadMaxBytes)()) {
            this.unlinkQuietly(file.filename);
            throw new common_1.BadRequestException(`Insurance document must be ${(0, file_storage_util_1.clientInsuranceUploadMaxMb)()} MB or smaller.`);
        }
        if (record.storedFileName) {
            this.unlinkQuietly(record.storedFileName);
        }
        const updated = await this.prisma.clientInsurancePolicy.update({
            where: { id },
            data: { fileName: file.originalname, storedFileName: file.filename },
            include: { site: { select: { name: true } } },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CLIENT_INSURANCE_DOCUMENT_UPLOADED',
            entityType: 'ClientInsurancePolicy',
            entityId: record.id,
            details: `Uploaded document for ${record.type} insurance policy - client "${record.client.name}"`,
        });
        return this.serialize(updated, record.client.name, updated.site?.name);
    }
    async findAll(user, filters = {}) {
        const clients = await this.prisma.client.findMany({
            where: {
                tenantId: user.tenantId,
                ...(0, branch_scope_1.branchWhere)(user),
                ...(filters.clientId ? { id: filters.clientId } : {}),
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        const clientIds = clients.map((c) => c.id);
        if (clientIds.length === 0)
            return [];
        const policies = await this.prisma.clientInsurancePolicy.findMany({
            where: {
                tenantId: user.tenantId,
                clientId: { in: clientIds },
                ...(filters.siteId ? { siteId: filters.siteId } : {}),
                ...(filters.type ? { type: filters.type } : {}),
            },
            include: { site: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
        });
        const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
        const seenClientType = new Set();
        const results = policies.map((policy) => {
            seenClientType.add(`${policy.clientId}:${policy.type}`);
            return this.serialize(policy, clientNameById.get(policy.clientId) || 'Unknown Client', policy.site?.name);
        });
        if (!filters.siteId && !filters.type) {
            for (const client of clients) {
                for (const type of client_insurance_types_constants_1.CLIENT_INSURANCE_REQUIRED_TYPES) {
                    if (!seenClientType.has(`${client.id}:${type}`)) {
                        results.push({
                            id: null,
                            clientId: client.id,
                            clientName: client.name,
                            siteId: null,
                            siteName: null,
                            scope: 'client_wide',
                            type,
                            status: compliance_status_util_1.ComplianceStatus.MISSING,
                            policyNumber: null,
                            insurer: null,
                            coverageAmount: null,
                            effectiveDate: null,
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
        }
        const statusFilter = filters.status?.trim().toUpperCase();
        if (statusFilter &&
            Object.values(compliance_status_util_1.ComplianceStatus).includes(statusFilter)) {
            return results.filter((r) => r.status === statusFilter);
        }
        return results;
    }
    async getSummary(user, clientId) {
        const rows = await this.findAll(user, clientId ? { clientId } : {});
        const summary = {
            total: rows.length,
            valid: 0,
            expiringSoon: 0,
            expired: 0,
            missing: 0,
        };
        for (const row of rows) {
            if (row.status === compliance_status_util_1.ComplianceStatus.VALID)
                summary.valid += 1;
            else if (row.status === compliance_status_util_1.ComplianceStatus.EXPIRING_SOON)
                summary.expiringSoon += 1;
            else if (row.status === compliance_status_util_1.ComplianceStatus.EXPIRED)
                summary.expired += 1;
            else if (row.status === compliance_status_util_1.ComplianceStatus.MISSING)
                summary.missing += 1;
        }
        return summary;
    }
    async getDocumentForDownload(user, id) {
        const record = await this.findRecordInScopeOrThrow(user, id);
        return this.resolveDocumentFile(record.storedFileName, record.fileName);
    }
    async findAllForClient(tenantId, clientId, userId) {
        const [client, policies] = await Promise.all([
            this.prisma.client.findFirst({
                where: { id: clientId, tenantId },
                select: { name: true },
            }),
            this.prisma.clientInsurancePolicy.findMany({
                where: { tenantId, clientId },
                include: { site: { select: { id: true, name: true } } },
                orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
            }),
        ]);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CLIENT_INSURANCE_LIST_VIEWED',
            entityType: 'ClientInsurancePolicy',
            details: 'Client viewed their insurance policy list',
        });
        return policies.map((policy) => this.serialize(policy, client?.name || '', policy.site?.name));
    }
    async getDocumentForClient(tenantId, clientId, policyId) {
        const record = await this.prisma.clientInsurancePolicy.findFirst({
            where: { id: policyId, tenantId, clientId },
            select: { storedFileName: true, fileName: true },
        });
        if (!record) {
            throw new common_1.NotFoundException('Insurance policy not found');
        }
        return this.resolveDocumentFile(record.storedFileName, record.fileName);
    }
    resolveDocumentFile(storedFileName, fileName) {
        if (!storedFileName) {
            throw new common_1.NotFoundException('No document uploaded for this policy');
        }
        const filePath = (0, path_1.join)(file_storage_util_1.CLIENT_INSURANCE_UPLOAD_DIR, storedFileName);
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new common_1.NotFoundException('Document file not found on server');
        }
        return {
            stream: (0, fs_1.createReadStream)(filePath),
            filename: fileName || storedFileName,
        };
    }
    static TYPES = client_insurance_types_constants_1.CLIENT_INSURANCE_TYPES;
};
exports.ClientComplianceService = ClientComplianceService;
exports.ClientComplianceService = ClientComplianceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ClientComplianceService);
//# sourceMappingURL=client-compliance.service.js.map