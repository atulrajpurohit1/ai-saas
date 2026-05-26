import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
export declare class SitesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private resolveClientId;
    create(userId: string, tenantId: string, dto: CreateSiteDto): Promise<{
        client: {
            id: string;
            name: string;
            companyName: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }>;
    findAll(tenantId: string): Promise<({
        client: {
            id: string;
            name: string;
            companyName: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string | null;
        address: string;
        instructions: string | null;
    })[]>;
    update(userId: string, tenantId: string, id: string, dto: UpdateSiteDto): Promise<{
        client: {
            id: string;
            name: string;
            companyName: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }>;
}
