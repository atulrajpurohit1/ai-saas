import { Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { FinanceInvoiceFilters, FinanceService } from './finance.service';
export declare class FinanceController {
    private readonly financeService;
    constructor(financeService: FinanceService);
    exportInvoices(user: ActiveUser, filters: FinanceInvoiceFilters, res: Response): Promise<void>;
    payments(user: ActiveUser, filters: FinanceInvoiceFilters): Promise<{
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
    outstanding(user: ActiveUser, filters: FinanceInvoiceFilters): Promise<{
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
    disputes(user: ActiveUser, filters: FinanceInvoiceFilters): Promise<{
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
    dashboard(user: ActiveUser, filters: FinanceInvoiceFilters): Promise<{
        totalIssuedAmount: number;
        totalPaidAmount: number;
        outstandingAmount: number;
        disputedAmount: number;
        invoiceCountByStatus: Record<string, number>;
    }>;
}
