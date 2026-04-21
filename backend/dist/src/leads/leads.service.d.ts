import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';
export declare class LeadsService {
    private prisma;
    private aiService;
    private auditService;
    constructor(prisma: PrismaService, aiService: AiService, auditService: AuditService);
    create(createLeadDto: CreateLeadDto, tenantId: string, userId?: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    findAll(tenantId: string): Promise<({
        deals: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            leadId: string;
            stage: string;
        }[];
        notes: {
            id: string;
            createdAt: Date;
            tenantId: string;
            leadId: string | null;
            content: string;
            dealId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    })[]>;
    findOne(id: string, tenantId: string): Promise<{
        deals: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            leadId: string;
            stage: string;
        }[];
        notes: {
            id: string;
            createdAt: Date;
            tenantId: string;
            leadId: string | null;
            content: string;
            dealId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    update(id: string, updateLeadDto: UpdateLeadDto, tenantId: string, userId?: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    updateStatus(id: string, updateLeadStatusDto: UpdateLeadStatusDto, tenantId: string, userId?: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    remove(id: string, tenantId: string, userId?: string): Promise<{
        success: boolean;
    }>;
    importLeads(buffer: Buffer, tenantId: string): Promise<{
        count: number;
    }>;
    exportLeads(tenantId: string): Promise<string>;
    processPdfLead(buffer: Buffer, tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    analyzePdf(buffer: Buffer): Promise<{
        name: string;
        company: string;
        email: string;
    }>;
}
