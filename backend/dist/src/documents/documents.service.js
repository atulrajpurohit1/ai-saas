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
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let DocumentsService = class DocumentsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(tenantId, uploadedBy, data) {
        const document = await this.prisma.sharedDocument.create({
            data: {
                ...data,
                tenantId,
                uploadedBy,
            },
        });
        await this.auditService.log({
            tenantId,
            userId: uploadedBy,
            action: 'DOCUMENT_SHARED',
            entityType: 'Document',
            entityId: document.id,
            details: `Document "${data.name}" shared with client`,
        });
        return document;
    }
    async findAll(tenantId, clientId) {
        return this.prisma.sharedDocument.findMany({
            where: {
                tenantId,
                ...(clientId ? { clientId } : {}),
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(tenantId, id) {
        const document = await this.prisma.sharedDocument.findFirst({
            where: { id, tenantId },
        });
        if (!document)
            throw new common_1.NotFoundException('Document not found');
        return document;
    }
    async remove(tenantId, id, userId) {
        await this.findOne(tenantId, id);
        const deleted = await this.prisma.sharedDocument.delete({
            where: { id },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'DOCUMENT_DELETED',
            entityType: 'Document',
            entityId: id,
        });
        return deleted;
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map