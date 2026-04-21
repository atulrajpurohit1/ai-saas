import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';
export declare class GuardsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(userId: string, tenantId: string, dto: CreateGuardDto): Promise<{
        id: string;
        name: string;
        phone: string | null;
        createdAt: Date;
        tenantId: string;
    }>;
    findAll(tenantId: string): Promise<{
        id: string;
        name: string;
        phone: string | null;
        createdAt: Date;
        tenantId: string;
    }[]>;
    update(userId: string, tenantId: string, id: string, dto: UpdateGuardDto): Promise<{
        id: string;
        name: string;
        phone: string | null;
        createdAt: Date;
        tenantId: string;
    }>;
}
