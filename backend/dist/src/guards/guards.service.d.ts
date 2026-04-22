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
        createdAt: Date;
        tenantId: string;
        phone: string | null;
    }>;
    findAll(tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        phone: string | null;
    }[]>;
    update(userId: string, tenantId: string, id: string, dto: UpdateGuardDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        phone: string | null;
    }>;
}
