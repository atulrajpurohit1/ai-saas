import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
export declare class SitesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private resolveClientId;
    create(user: ActiveUser, dto: CreateSiteDto): Promise<{
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
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
        branchId: string | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }>;
    findAll(user: ActiveUser, requestedBranchId?: string | null): Promise<({
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
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
        branchId: string | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    })[]>;
    update(user: ActiveUser, id: string, dto: UpdateSiteDto): Promise<{
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
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
        branchId: string | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }>;
}
