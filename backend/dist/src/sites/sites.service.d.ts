import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
export declare class SitesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(userId: string, tenantId: string, dto: CreateSiteDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        address: string;
        instructions: string | null;
    }>;
    findAll(tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        address: string;
        instructions: string | null;
    }[]>;
    update(userId: string, tenantId: string, id: string, dto: UpdateSiteDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        address: string;
        instructions: string | null;
    }>;
}
