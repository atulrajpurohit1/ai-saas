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
exports.FinanceService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const INVOICE_STATUSES = ['draft', 'issued', 'disputed', 'resolved', 'paid', 'cancelled'];
const DISPUTE_STATUSES = ['open', 'under_review', 'resolved', 'rejected'];
const ISSUED_LIFECYCLE_STATUSES = ['issued', 'disputed', 'resolved', 'paid'];
const OUTSTANDING_STATUSES = ['issued', 'resolved'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
let FinanceService = class FinanceService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    getFilterValue(value) {
        return Array.isArray(value) ? value[0] : value;
    }
    normalizeOptionalFilter(value) {
        const trimmed = this.getFilterValue(value)?.trim();
        return trimmed && trimmed !== 'all' ? trimmed : undefined;
    }
    parseDateBoundary(value, fieldName) {
        const trimmed = this.getFilterValue(value)?.trim();
        if (!trimmed) {
            return undefined;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [year, month, day] = trimmed.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));
            if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
                throw new common_1.BadRequestException(`${fieldName} must be a valid date`);
            }
            return { date, dateOnly: true };
        }
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
            throw new common_1.BadRequestException(`${fieldName} must be a valid date`);
        }
        return { date: parsed, dateOnly: false };
    }
    assertInvoiceStatus(status) {
        if (status && !INVOICE_STATUSES.includes(status)) {
            throw new common_1.BadRequestException('Invalid invoice status');
        }
    }
    assertDisputeStatus(status) {
        if (status && !DISPUTE_STATUSES.includes(status)) {
            throw new common_1.BadRequestException('Invalid dispute status');
        }
    }
    getDateRange(filters) {
        let startBoundary = this.parseDateBoundary(filters.start_date, 'start_date');
        let endBoundary = this.parseDateBoundary(filters.end_date, 'end_date');
        if (startBoundary && endBoundary && endBoundary.date < startBoundary.date) {
            [startBoundary, endBoundary] = [endBoundary, startBoundary];
        }
        const start = startBoundary?.date;
        const end = endBoundary ? new Date(endBoundary.date) : undefined;
        if (end && endBoundary?.dateOnly) {
            end.setUTCDate(end.getUTCDate() + 1);
        }
        return { start, end };
    }
    applyInvoiceDateRange(where, filters, field = 'issuedAt') {
        const { start, end } = this.getDateRange(filters);
        if (!start && !end) {
            return;
        }
        const range = {};
        if (start) {
            range.gte = start;
        }
        if (end) {
            range.lt = end;
        }
        if (field === 'paidAt') {
            where.paidAt = range;
        }
        else if (field === 'dueDate') {
            where.dueDate = range;
        }
        else {
            where.issuedAt = range;
        }
    }
    buildInvoiceWhere(tenantId, filters, dateField = 'issuedAt') {
        const clientId = this.normalizeOptionalFilter(filters.client_id);
        const status = this.normalizeOptionalFilter(filters.status);
        this.assertInvoiceStatus(status);
        const where = {
            tenantId,
            ...(clientId ? { clientId } : {}),
            ...(status ? { status } : {}),
        };
        this.applyInvoiceDateRange(where, filters, dateField);
        return where;
    }
    buildDisputeWhere(tenantId, filters) {
        const clientId = this.normalizeOptionalFilter(filters.client_id);
        const status = this.normalizeOptionalFilter(filters.status);
        this.assertDisputeStatus(status);
        const where = {
            tenantId,
            ...(clientId ? { clientId } : {}),
            ...(status ? { status } : {}),
        };
        const { start, end } = this.getDateRange(filters);
        if (start || end) {
            where.createdAt = {
                ...(start ? { gte: start } : {}),
                ...(end ? { lt: end } : {}),
            };
        }
        return where;
    }
    invoiceReportInclude() {
        return {
            client: {
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    email: true,
                },
            },
            site: {
                select: {
                    id: true,
                    name: true,
                },
            },
            disputes: {
                orderBy: {
                    createdAt: 'desc',
                },
                take: 1,
            },
        };
    }
    disputeReportInclude() {
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
                    totalAmount: true,
                    issuedAt: true,
                    paidAt: true,
                    dueDate: true,
                    site: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        };
    }
    clientName(client) {
        return client?.companyName || client?.name || '';
    }
    formatDateOnly(value) {
        if (!value) {
            return '';
        }
        return new Date(value).toISOString().slice(0, 10);
    }
    formatDateTime(value) {
        if (!value) {
            return '';
        }
        return new Date(value).toISOString();
    }
    formatBillingPeriod(invoice) {
        return `${this.formatDateOnly(invoice.billingStartDate)} to ${this.formatDateOnly(invoice.billingEndDate)}`;
    }
    roundCurrency(value) {
        return Math.round(value * 100) / 100;
    }
    sumInvoices(invoices) {
        return this.roundCurrency(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
    }
    csvEscape(value) {
        if (value === null || value === undefined) {
            return '';
        }
        const text = String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }
    buildCsv(headers, rows) {
        return [
            headers.map((header) => this.csvEscape(header)).join(','),
            ...rows.map((row) => row.map((value) => this.csvEscape(value)).join(',')),
        ].join('\r\n');
    }
    async logReportViewed(tenantId, userId, reportName) {
        await this.auditService.log({
            tenantId,
            userId,
            action: 'FINANCE_REPORT_VIEWED',
            entityType: 'FinanceReport',
            details: `${reportName} viewed`,
        });
    }
    async getDashboard(tenantId, userId, filters) {
        const invoices = await this.prisma.invoice.findMany({
            where: this.buildInvoiceWhere(tenantId, filters),
            select: {
                id: true,
                status: true,
                totalAmount: true,
            },
        });
        const invoiceCountByStatus = INVOICE_STATUSES.reduce((counts, status) => {
            counts[status] = 0;
            return counts;
        }, {});
        invoices.forEach((invoice) => {
            invoiceCountByStatus[invoice.status] = (invoiceCountByStatus[invoice.status] || 0) + 1;
        });
        await this.logReportViewed(tenantId, userId, 'Finance dashboard');
        return {
            totalIssuedAmount: this.sumInvoices(invoices.filter((invoice) => ISSUED_LIFECYCLE_STATUSES.includes(invoice.status))),
            totalPaidAmount: this.sumInvoices(invoices.filter((invoice) => invoice.status === 'paid')),
            outstandingAmount: this.sumInvoices(invoices.filter((invoice) => OUTSTANDING_STATUSES.includes(invoice.status))),
            disputedAmount: this.sumInvoices(invoices.filter((invoice) => invoice.status === 'disputed')),
            invoiceCountByStatus,
        };
    }
    async exportInvoicesCsv(tenantId, userId, filters) {
        const invoices = await this.prisma.invoice.findMany({
            where: this.buildInvoiceWhere(tenantId, filters),
            include: this.invoiceReportInclude(),
            orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }, { invoiceNumber: 'desc' }],
        });
        const csv = this.buildCsv([
            'invoice_number',
            'client_name',
            'site_name',
            'billing_period',
            'total_hours',
            'subtotal',
            'tax',
            'total_amount',
            'status',
            'issued_at',
            'paid_at',
        ], invoices.map((invoice) => [
            invoice.invoiceNumber,
            this.clientName(invoice.client),
            invoice.site?.name || '',
            this.formatBillingPeriod(invoice),
            invoice.totalHours,
            invoice.subtotal,
            invoice.tax,
            invoice.totalAmount,
            invoice.status,
            this.formatDateTime(invoice.issuedAt),
            this.formatDateTime(invoice.paidAt),
        ]));
        await this.auditService.log({
            tenantId,
            userId,
            action: 'FINANCE_EXPORT_GENERATED',
            entityType: 'Invoice',
            details: `Invoice CSV export generated with ${invoices.length} rows`,
        });
        return {
            csv,
            filename: `finance-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
        };
    }
    async getPaymentReport(tenantId, userId, filters) {
        const where = this.buildInvoiceWhere(tenantId, { ...filters, status: 'paid' }, 'paidAt');
        const invoices = await this.prisma.invoice.findMany({
            where,
            include: this.invoiceReportInclude(),
            orderBy: [{ paidAt: 'desc' }, { issuedAt: 'desc' }, { invoiceNumber: 'desc' }],
        });
        await this.logReportViewed(tenantId, userId, 'Payment report');
        return invoices.map((invoice) => ({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            paymentStatus: invoice.status,
            amount: invoice.totalAmount,
            paidDate: invoice.paidAt,
            issuedAt: invoice.issuedAt,
            client: invoice.client
                ? {
                    id: invoice.client.id,
                    name: invoice.client.name,
                    companyName: invoice.client.companyName,
                    email: invoice.client.email,
                }
                : null,
            site: invoice.site
                ? {
                    id: invoice.site.id,
                    name: invoice.site.name,
                }
                : null,
        }));
    }
    async getOutstandingReport(tenantId, userId, filters) {
        const where = this.buildInvoiceWhere(tenantId, filters);
        where.status = { in: OUTSTANDING_STATUSES };
        const invoices = await this.prisma.invoice.findMany({
            where,
            include: this.invoiceReportInclude(),
            orderBy: [{ dueDate: 'asc' }, { issuedAt: 'desc' }, { invoiceNumber: 'desc' }],
        });
        const now = new Date();
        await this.logReportViewed(tenantId, userId, 'Outstanding invoice report');
        return invoices.map((invoice) => {
            const isOverdue = Boolean(invoice.dueDate && invoice.dueDate < now);
            const daysOverdue = isOverdue && invoice.dueDate ? Math.ceil((now.getTime() - invoice.dueDate.getTime()) / MS_PER_DAY) : 0;
            return {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                status: invoice.status,
                amount: invoice.totalAmount,
                issuedAt: invoice.issuedAt,
                dueDate: invoice.dueDate,
                isOverdue,
                daysOverdue,
                client: invoice.client
                    ? {
                        id: invoice.client.id,
                        name: invoice.client.name,
                        companyName: invoice.client.companyName,
                        email: invoice.client.email,
                    }
                    : null,
                site: invoice.site
                    ? {
                        id: invoice.site.id,
                        name: invoice.site.name,
                    }
                    : null,
            };
        });
    }
    async getDisputeReport(tenantId, userId, filters) {
        const disputes = await this.prisma.invoiceDispute.findMany({
            where: this.buildDisputeWhere(tenantId, filters),
            include: this.disputeReportInclude(),
            orderBy: [{ createdAt: 'desc' }],
        });
        await this.logReportViewed(tenantId, userId, 'Dispute report');
        return disputes.map((dispute) => ({
            disputeId: dispute.id,
            invoiceId: dispute.invoiceId,
            invoiceNumber: dispute.invoice?.invoiceNumber || '',
            disputeReason: dispute.reason,
            description: dispute.description,
            status: dispute.status,
            amount: dispute.invoice?.totalAmount || 0,
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
            invoiceStatus: dispute.invoice?.status || null,
            site: dispute.invoice?.site
                ? {
                    id: dispute.invoice.site.id,
                    name: dispute.invoice.site.name,
                }
                : null,
        }));
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], FinanceService);
//# sourceMappingURL=finance.service.js.map