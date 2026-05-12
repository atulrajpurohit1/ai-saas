import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { AuditService } from '../audit/audit.service';
export declare class DealsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(createDealDto: CreateDealDto, tenantId: string, userId?: string): Promise<{
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    }>;
    convertLeadToDeal(leadId: string, tenantId: string, userId?: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    }>;
    findAll(tenantId: string): Promise<({
        client: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string;
            companyName: string | null;
            phone: string | null;
        } | null;
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    })[]>;
    findOne(id: string, tenantId: string): Promise<{
        client: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string;
            companyName: string | null;
            phone: string | null;
        } | null;
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    }>;
    updateStage(id: string, updateDealStageDto: UpdateDealStageDto, tenantId: string, userId?: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    }>;
    remove(id: string, tenantId: string, userId?: string): Promise<{
        success: boolean;
    }>;
}
