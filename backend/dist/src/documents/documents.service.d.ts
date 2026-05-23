import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDocumentDto } from './dto/create-document.dto';
export declare class DocumentsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(tenantId: string, uploadedBy: string, data: CreateDocumentDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        url: string;
        description: string | null;
        uploadedBy: string;
    }>;
    findAll(tenantId: string, clientId?: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        url: string;
        description: string | null;
        uploadedBy: string;
    }[]>;
    findOne(tenantId: string, id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        url: string;
        description: string | null;
        uploadedBy: string;
    }>;
    remove(tenantId: string, id: string, userId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        url: string;
        description: string | null;
        uploadedBy: string;
    }>;
}
