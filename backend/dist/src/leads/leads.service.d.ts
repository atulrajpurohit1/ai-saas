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
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    findAll(tenantId: string): Promise<({
        deals: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            stage: string;
        }[];
        notes: {
            id: string;
            tenantId: string;
            createdAt: Date;
            content: string;
            dealId: string | null;
            leadId: string | null;
        }[];
    } & {
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    })[]>;
    findOne(id: string, tenantId: string): Promise<{
        deals: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            stage: string;
        }[];
        notes: {
            id: string;
            tenantId: string;
            createdAt: Date;
            content: string;
            dealId: string | null;
            leadId: string | null;
        }[];
    } & {
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    update(id: string, updateLeadDto: UpdateLeadDto, tenantId: string, userId?: string): Promise<{
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    updateStatus(id: string, updateLeadStatusDto: UpdateLeadStatusDto, tenantId: string, userId?: string): Promise<{
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    remove(id: string, tenantId: string, userId?: string): Promise<{
        success: boolean;
    }>;
    importLeads(buffer: Buffer, tenantId: string): Promise<{
        count: number;
    }>;
    exportLeads(tenantId: string): Promise<string>;
    processPdfLead(buffer: Buffer, tenantId: string): Promise<{
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    analyzePdf(buffer: Buffer): Promise<{
        name: string;
        company: string;
        email: string;
    }>;
}
