import { PublicApiRequest } from './public-api.types';
import { PublicApiService } from './public-api.service';
export declare class PublicApiController {
    private readonly publicApiService;
    constructor(publicApiService: PublicApiService);
    listClients(request: PublicApiRequest, query: Record<string, string | undefined>): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
    }[]>;
    createClient(request: PublicApiRequest, body: any): Promise<{
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
    listSites(request: PublicApiRequest, query: Record<string, string | undefined>): Promise<{
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
    createSite(request: PublicApiRequest, body: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }>;
    listGuards(request: PublicApiRequest, query: Record<string, string | undefined>): Promise<{
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
    createGuard(request: PublicApiRequest, body: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        branchId: string | null;
        phone: string | null;
    }>;
    listShifts(request: PublicApiRequest, query: Record<string, string | undefined>): Promise<({
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
    createShift(request: PublicApiRequest, body: any): Promise<{
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
    assignShift(request: PublicApiRequest, id: string, body: any): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        guardId: string;
        shiftId: string;
    }>;
    listIncidents(request: PublicApiRequest, query: Record<string, string | undefined>): Promise<({
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
    createIncident(request: PublicApiRequest, body: any): Promise<{
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
    listInvoices(request: PublicApiRequest, query: Record<string, string | undefined>): Promise<({
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
    listReports(request: PublicApiRequest, query: Record<string, string | undefined>): Promise<({
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
        summary: string;
        siteId: string;
        reportDate: Date;
        publishedAt: Date | null;
    })[]>;
}
