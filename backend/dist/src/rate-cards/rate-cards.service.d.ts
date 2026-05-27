import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { UpdateRateCardDto } from './dto/update-rate-card.dto';
export declare class RateCardsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private rateCardInclude;
    private mapRateCard;
    private parseDate;
    private parseOptionalDate;
    private parseOptionalRate;
    private resolveClient;
    private resolveSite;
    private validateEffectiveRange;
    private findRateCardOrThrow;
    create(tenantId: string, userId: string, dto: CreateRateCardDto): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    findAll(tenantId: string, status?: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }[]>;
    findOne(tenantId: string, id: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    update(tenantId: string, userId: string, id: string, dto: UpdateRateCardDto): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    deactivate(tenantId: string, userId: string, id: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
}
