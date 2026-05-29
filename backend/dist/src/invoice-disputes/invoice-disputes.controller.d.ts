import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CloseInvoiceDisputeDto, RespondInvoiceDisputeDto } from './dto/respond-invoice-dispute.dto';
import { InvoiceDisputesService } from './invoice-disputes.service';
export declare class InvoiceDisputesController {
    private readonly invoiceDisputesService;
    constructor(invoiceDisputesService: InvoiceDisputesService);
    findAll(user: ActiveUser): Promise<{
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
    findOne(user: ActiveUser, id: string): Promise<{
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
    respond(user: ActiveUser, id: string, dto: RespondInvoiceDisputeDto): Promise<{
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
    resolve(user: ActiveUser, id: string, dto: CloseInvoiceDisputeDto): Promise<{
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
    reject(user: ActiveUser, id: string, dto: CloseInvoiceDisputeDto): Promise<{
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
