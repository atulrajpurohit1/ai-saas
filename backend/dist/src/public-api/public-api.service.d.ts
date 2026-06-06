import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyContext } from '../api-keys/api-keys.service';
import { WebhooksService } from '../webhooks/webhooks.service';
export declare class PublicApiService {
    private readonly prisma;
    private readonly auditService;
    private readonly webhooksService;
    constructor(prisma: PrismaService, auditService: AuditService, webhooksService: WebhooksService);
    listClients(apiKey: ApiKeyContext, query: Record<string, string | undefined>): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
    }[]>;
    createClient(apiKey: ApiKeyContext, body: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
    }>;
    listSites(apiKey: ApiKeyContext, query: Record<string, string | undefined>): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        branchId: string | null;
        client: {
            id: string;
            name: string;
            email: string;
            companyName: string | null;
        } | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }[]>;
    createSite(apiKey: ApiKeyContext, body: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }>;
    listGuards(apiKey: ApiKeyContext, query: Record<string, string | undefined>): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        branchId: string | null;
        phone: string | null;
        availability: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            status: string;
            startDate: Date | null;
            endDate: Date | null;
            guardId: string;
        } | null;
    }[]>;
    createGuard(apiKey: ApiKeyContext, body: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        branchId: string | null;
        phone: string | null;
    }>;
    listShifts(apiKey: ApiKeyContext, query: Record<string, string | undefined>): Promise<({
        site: {
            id: string;
            name: string;
            clientId: string | null;
            address: string;
        };
        assignments: ({
            guard: {
                id: string;
                name: string;
                email: string | null;
                phone: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            status: string;
            guardId: string;
            shiftId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        status: string;
        siteId: string;
        startTime: Date;
        endTime: Date;
        requiredGuards: number;
    })[]>;
    createShift(apiKey: ApiKeyContext, body: any): Promise<{
        site: {
            id: string;
            name: string;
            address: string;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        status: string;
        siteId: string;
        startTime: Date;
        endTime: Date;
        requiredGuards: number;
    }>;
    assignShift(apiKey: ApiKeyContext, shiftId: string, body: any): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        guardId: string;
        shiftId: string;
    }>;
    listIncidents(apiKey: ApiKeyContext, query: Record<string, string | undefined>): Promise<({
        site: {
            id: string;
            name: string;
            address: string;
        };
        guard: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        };
        shift: {
            id: string;
            status: string;
            startTime: Date;
            endTime: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        notes: string | null;
        tenantId: string;
        branchId: string | null;
        title: string;
        status: string;
        description: string;
        guardId: string;
        siteId: string;
        shiftId: string;
        severity: string;
        occurredAt: Date;
        attachmentUrl: string | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        reviewNote: string | null;
    })[]>;
    createIncident(apiKey: ApiKeyContext, body: any): Promise<{
        id: string;
        createdAt: Date;
        notes: string | null;
        tenantId: string;
        branchId: string | null;
        title: string;
        status: string;
        description: string;
        guardId: string;
        siteId: string;
        shiftId: string;
        severity: string;
        occurredAt: Date;
        attachmentUrl: string | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        reviewNote: string | null;
    }>;
    listInvoices(apiKey: ApiKeyContext, query: Record<string, string | undefined>): Promise<({
        client: {
            id: string;
            name: string;
            email: string;
            companyName: string | null;
        };
        site: {
            id: string;
            name: string;
            address: string;
        };
        items: {
            id: string;
            guardId: string;
            shiftId: string;
            hourlyRate: number;
            rateCardId: string | null;
            invoiceId: string;
            workedHours: number;
            amount: number;
            timesheetId: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        clientId: string;
        status: string;
        dueDate: Date | null;
        siteId: string;
        invoiceNumber: string;
        billingStartDate: Date;
        billingEndDate: Date;
        totalHours: number;
        hourlyRate: number;
        subtotal: number;
        tax: number;
        totalAmount: number;
        issuedAt: Date | null;
        paidAt: Date | null;
        rateCardId: string | null;
        rateSource: string;
    })[]>;
    listReports(apiKey: ApiKeyContext, query: Record<string, string | undefined>): Promise<({
        client: {
            id: string;
            name: string;
            email: string;
            companyName: string | null;
        };
        site: {
            id: string;
            name: string;
            address: string;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        clientId: string;
        status: string;
        siteId: string;
        summary: string;
        reportDate: Date;
        publishedAt: Date | null;
    })[]>;
    private resolveBranch;
    private auditEntity;
    private limit;
    private requiredString;
    private optionalString;
    private requiredDate;
}
