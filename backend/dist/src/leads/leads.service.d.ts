import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { AiService } from '../ai/ai.service';
export declare class LeadsService {
    private prisma;
    private aiService;
    constructor(prisma: PrismaService, aiService: AiService);
    create(createLeadDto: CreateLeadDto, tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    findAll(tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }[]>;
    findOne(id: string, tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    update(id: string, updateLeadDto: UpdateLeadDto, tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    updateStatus(id: string, updateLeadStatusDto: UpdateLeadStatusDto, tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    remove(id: string, tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
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
