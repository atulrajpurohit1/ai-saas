import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloseInvoiceDisputeDto, RespondInvoiceDisputeDto } from './dto/respond-invoice-dispute.dto';
export declare class InvoiceDisputesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private disputeInclude;
    private mapDispute;
    private findDisputeOrThrow;
    private assertActive;
    private getResponse;
    private moveToUnderReview;
    findAll(tenantId: string): Promise<{
        id: any;
        invoiceId: any;
        clientId: any;
        tenantId: any;
        reason: any;
        description: any;
        status: any;
        adminResponse: any;
        createdAt: any;
        resolvedAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        invoice: {
            id: any;
            invoiceNumber: any;
            status: any;
            billingStartDate: any;
            billingEndDate: any;
            totalAmount: any;
            issuedAt: any;
            site: {
                id: any;
                name: any;
                address: any;
            } | null;
        } | null;
    }[]>;
    findOne(tenantId: string, userId: string, id: string): Promise<{
        id: any;
        invoiceId: any;
        clientId: any;
        tenantId: any;
        reason: any;
        description: any;
        status: any;
        adminResponse: any;
        createdAt: any;
        resolvedAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        invoice: {
            id: any;
            invoiceNumber: any;
            status: any;
            billingStartDate: any;
            billingEndDate: any;
            totalAmount: any;
            issuedAt: any;
            site: {
                id: any;
                name: any;
                address: any;
            } | null;
        } | null;
    }>;
    respond(tenantId: string, userId: string, id: string, dto: RespondInvoiceDisputeDto): Promise<{
        id: any;
        invoiceId: any;
        clientId: any;
        tenantId: any;
        reason: any;
        description: any;
        status: any;
        adminResponse: any;
        createdAt: any;
        resolvedAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        invoice: {
            id: any;
            invoiceNumber: any;
            status: any;
            billingStartDate: any;
            billingEndDate: any;
            totalAmount: any;
            issuedAt: any;
            site: {
                id: any;
                name: any;
                address: any;
            } | null;
        } | null;
    }>;
    resolve(tenantId: string, userId: string, id: string, dto?: CloseInvoiceDisputeDto): Promise<{
        id: any;
        invoiceId: any;
        clientId: any;
        tenantId: any;
        reason: any;
        description: any;
        status: any;
        adminResponse: any;
        createdAt: any;
        resolvedAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        invoice: {
            id: any;
            invoiceNumber: any;
            status: any;
            billingStartDate: any;
            billingEndDate: any;
            totalAmount: any;
            issuedAt: any;
            site: {
                id: any;
                name: any;
                address: any;
            } | null;
        } | null;
    }>;
    reject(tenantId: string, userId: string, id: string, dto?: CloseInvoiceDisputeDto): Promise<{
        id: any;
        invoiceId: any;
        clientId: any;
        tenantId: any;
        reason: any;
        description: any;
        status: any;
        adminResponse: any;
        createdAt: any;
        resolvedAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        invoice: {
            id: any;
            invoiceNumber: any;
            status: any;
            billingStartDate: any;
            billingEndDate: any;
            totalAmount: any;
            issuedAt: any;
            site: {
                id: any;
                name: any;
                address: any;
            } | null;
        } | null;
    }>;
}
