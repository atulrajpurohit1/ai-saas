import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
export interface FinanceInvoiceFilters {
    start_date?: string | string[];
    end_date?: string | string[];
    client_id?: string | string[];
    status?: string | string[];
}
export declare class FinanceService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private getFilterValue;
    private normalizeOptionalFilter;
    private parseDateBoundary;
    private assertInvoiceStatus;
    private assertDisputeStatus;
    private getDateRange;
    private applyInvoiceDateRange;
    private buildInvoiceWhere;
    private buildDisputeWhere;
    private invoiceReportInclude;
    private disputeReportInclude;
    private clientName;
    private formatDateOnly;
    private formatDateTime;
    private formatBillingPeriod;
    private roundCurrency;
    private sumInvoices;
    private csvEscape;
    private buildCsv;
    private logReportViewed;
    getDashboard(tenantId: string, userId: string, filters: FinanceInvoiceFilters): Promise<{
        totalIssuedAmount: number;
        totalPaidAmount: number;
        outstandingAmount: number;
        disputedAmount: number;
        invoiceCountByStatus: Record<string, number>;
    }>;
    exportInvoicesCsv(tenantId: string, userId: string, filters: FinanceInvoiceFilters): Promise<{
        csv: string;
        filename: string;
    }>;
    getPaymentReport(tenantId: string, userId: string, filters: FinanceInvoiceFilters): Promise<{
        invoiceId: string;
        invoiceNumber: string;
        paymentStatus: string;
        amount: number;
        paidDate: Date | null;
        issuedAt: Date | null;
        client: {
            id: string;
            name: string;
            companyName: string | null;
            email: string;
        } | null;
        site: {
            id: string;
            name: string;
        } | null;
    }[]>;
    getOutstandingReport(tenantId: string, userId: string, filters: FinanceInvoiceFilters): Promise<{
        invoiceId: string;
        invoiceNumber: string;
        status: string;
        amount: number;
        issuedAt: Date | null;
        dueDate: Date | null;
        isOverdue: boolean;
        daysOverdue: number;
        client: {
            id: string;
            name: string;
            companyName: string | null;
            email: string;
        } | null;
        site: {
            id: string;
            name: string;
        } | null;
    }[]>;
    getDisputeReport(tenantId: string, userId: string, filters: FinanceInvoiceFilters): Promise<{
        disputeId: string;
        invoiceId: string;
        invoiceNumber: string;
        disputeReason: string;
        description: string;
        status: string;
        amount: number;
        createdAt: Date;
        resolvedAt: Date | null;
        client: {
            id: string;
            name: string;
            companyName: string | null;
            email: string;
        } | null;
        invoiceStatus: string | null;
        site: {
            id: string;
            name: string;
        } | null;
    }[]>;
}
