import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
export declare class ClientsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(userId: string, tenantId: string, dto: CreateClientDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        companyName: string | null;
        phone: string | null;
    }>;
    findAll(tenantId: string): Promise<({
        users: {
            email: string;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        companyName: string | null;
        phone: string | null;
    })[]>;
    findOne(tenantId: string, id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        companyName: string | null;
        phone: string | null;
    }>;
    update(userId: string, tenantId: string, id: string, dto: UpdateClientDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        companyName: string | null;
        phone: string | null;
    }>;
    createClientUser(tenantId: string, clientId: string, email: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        password: string;
        refreshToken: string | null;
        tenantId: string;
        clientId: string;
    }>;
}
