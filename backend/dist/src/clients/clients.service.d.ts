import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { FieldPermissionsService } from '../field-permissions/field-permissions.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { WebhooksService } from '../webhooks/webhooks.service';
export declare class ClientsService {
    private prisma;
    private auditService;
    private webhooksService;
    private fieldPermissionsService;
    constructor(prisma: PrismaService, auditService: AuditService, webhooksService: WebhooksService, fieldPermissionsService: FieldPermissionsService);
    private optionalText;
    private sensitiveClientData;
    create(user: ActiveUser, dto: CreateClientDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
        billingNotes: string | null;
        internalNotes: string | null;
    }>;
    findAll(user: ActiveUser, requestedBranchId?: string | null): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        users: {
            id: string;
            createdAt: Date;
            email: string;
        }[];
        email: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
        companyName: string | null;
        phone: string | null;
        billingNotes: string | null;
        internalNotes: string | null;
    }[]>;
    findOne(user: ActiveUser, id: string): Promise<{
        users: {
            id: string;
            createdAt: Date;
            email: string;
        }[];
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
        billingNotes: string | null;
        internalNotes: string | null;
    }>;
    update(user: ActiveUser, id: string, dto: UpdateClientDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
        billingNotes: string | null;
        internalNotes: string | null;
    }>;
    createClientUser(user: ActiveUser, clientId: string, email: string): Promise<{
        id: string;
        email: string;
        clientId: string;
        temporaryPassword: string;
    }>;
}
