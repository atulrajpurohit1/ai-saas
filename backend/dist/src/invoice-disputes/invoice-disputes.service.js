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
exports.InvoiceDisputesService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const ACTIVE_DISPUTE_STATUSES = ['open', 'under_review'];
const FINAL_DISPUTE_STATUSES = ['resolved', 'rejected'];
let InvoiceDisputesService = class InvoiceDisputesService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    disputeInclude() {
        return {
            client: {
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    email: true,
                },
            },
            invoice: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    status: true,
                    billingStartDate: true,
                    billingEndDate: true,
                    totalAmount: true,
                    issuedAt: true,
                    site: {
                        select: {
                            id: true,
                            name: true,
                            address: true,
                        },
                    },
                },
            },
        };
    }
    mapDispute(dispute) {
        return {
            id: dispute.id,
            invoiceId: dispute.invoiceId,
            clientId: dispute.clientId,
            tenantId: dispute.tenantId,
            reason: dispute.reason,
            description: dispute.description,
            status: dispute.status,
            adminResponse: dispute.adminResponse,
            createdAt: dispute.createdAt,
            resolvedAt: dispute.resolvedAt,
            client: dispute.client
                ? {
                    id: dispute.client.id,
                    name: dispute.client.name,
                    companyName: dispute.client.companyName,
                    email: dispute.client.email,
                }
                : null,
            invoice: dispute.invoice
                ? {
                    id: dispute.invoice.id,
                    invoiceNumber: dispute.invoice.invoiceNumber,
                    status: dispute.invoice.status,
                    billingStartDate: dispute.invoice.billingStartDate,
                    billingEndDate: dispute.invoice.billingEndDate,
                    totalAmount: dispute.invoice.totalAmount,
                    issuedAt: dispute.invoice.issuedAt,
                    site: dispute.invoice.site
                        ? {
                            id: dispute.invoice.site.id,
                            name: dispute.invoice.site.name,
                            address: dispute.invoice.site.address,
                        }
                        : null,
                }
                : null,
        };
    }
    async findDisputeOrThrow(tenantId, id) {
        const dispute = await this.prisma.invoiceDispute.findFirst({
            where: { id, tenantId },
            include: this.disputeInclude(),
        });
        if (!dispute) {
            throw new common_1.NotFoundException('Invoice dispute not found');
        }
        return dispute;
    }
    assertActive(status) {
        if (FINAL_DISPUTE_STATUSES.includes(status)) {
            throw new common_1.BadRequestException('Invoice dispute has already been closed');
        }
    }
    getResponse(dto) {
        return dto?.admin_response?.trim() || undefined;
    }
    async moveToUnderReview(tenantId, userId, dispute) {
        if (dispute.status !== 'open') {
            return dispute;
        }
        await this.prisma.invoiceDispute.update({
            where: { id: dispute.id },
            data: { status: 'under_review' },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'INVOICE_DISPUTE_UNDER_REVIEW',
            entityType: 'InvoiceDispute',
            entityId: dispute.id,
            details: `Invoice dispute for ${dispute.invoice?.invoiceNumber || dispute.invoiceId} moved under review`,
        });
        return this.findDisputeOrThrow(tenantId, dispute.id);
    }
    async findAll(tenantId) {
        const disputes = await this.prisma.invoiceDispute.findMany({
            where: { tenantId },
            include: this.disputeInclude(),
            orderBy: [{ createdAt: 'desc' }],
        });
        return disputes.map((dispute) => this.mapDispute(dispute));
    }
    async findOne(tenantId, userId, id) {
        const dispute = await this.findDisputeOrThrow(tenantId, id);
        const reviewed = await this.moveToUnderReview(tenantId, userId, dispute);
        return this.mapDispute(reviewed);
    }
    async respond(tenantId, userId, id, dto) {
        const response = this.getResponse(dto);
        if (!response) {
            throw new common_1.BadRequestException('admin_response is required');
        }
        const dispute = await this.findDisputeOrThrow(tenantId, id);
        this.assertActive(dispute.status);
        const updated = await this.prisma.invoiceDispute.update({
            where: { id },
            data: {
                status: 'under_review',
                adminResponse: response,
            },
            include: this.disputeInclude(),
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'INVOICE_DISPUTE_RESPONDED',
            entityType: 'InvoiceDispute',
            entityId: updated.id,
            details: `Admin responded to invoice dispute for ${updated.invoice.invoiceNumber}`,
        });
        return this.mapDispute(updated);
    }
    async resolve(tenantId, userId, id, dto) {
        const response = this.getResponse(dto);
        const dispute = await this.findDisputeOrThrow(tenantId, id);
        this.assertActive(dispute.status);
        const updated = await this.prisma.$transaction(async (tx) => {
            const closed = await tx.invoiceDispute.update({
                where: { id },
                data: {
                    status: 'resolved',
                    resolvedAt: new Date(),
                    ...(response ? { adminResponse: response } : {}),
                },
                include: this.disputeInclude(),
            });
            await tx.invoice.updateMany({
                where: {
                    id: closed.invoiceId,
                    tenantId,
                    status: { in: ['disputed', 'issued'] },
                },
                data: { status: 'resolved' },
            });
            return closed;
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'INVOICE_DISPUTE_RESOLVED',
            entityType: 'InvoiceDispute',
            entityId: updated.id,
            details: `Invoice dispute for ${updated.invoice.invoiceNumber} resolved`,
        });
        return this.mapDispute(await this.findDisputeOrThrow(tenantId, id));
    }
    async reject(tenantId, userId, id, dto) {
        const response = this.getResponse(dto);
        const dispute = await this.findDisputeOrThrow(tenantId, id);
        this.assertActive(dispute.status);
        const updated = await this.prisma.$transaction(async (tx) => {
            const closed = await tx.invoiceDispute.update({
                where: { id },
                data: {
                    status: 'rejected',
                    resolvedAt: new Date(),
                    ...(response ? { adminResponse: response } : {}),
                },
                include: this.disputeInclude(),
            });
            await tx.invoice.updateMany({
                where: {
                    id: closed.invoiceId,
                    tenantId,
                    status: 'disputed',
                },
                data: { status: 'issued' },
            });
            return closed;
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'INVOICE_DISPUTE_REJECTED',
            entityType: 'InvoiceDispute',
            entityId: updated.id,
            details: `Invoice dispute for ${updated.invoice.invoiceNumber} rejected`,
        });
        return this.mapDispute(await this.findDisputeOrThrow(tenantId, id));
    }
};
exports.InvoiceDisputesService = InvoiceDisputesService;
exports.InvoiceDisputesService = InvoiceDisputesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], InvoiceDisputesService);
//# sourceMappingURL=invoice-disputes.service.js.map