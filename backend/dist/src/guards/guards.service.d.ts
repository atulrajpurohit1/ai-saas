import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { FieldPermissionsService } from '../field-permissions/field-permissions.service';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { WebhooksService } from '../webhooks/webhooks.service';
export declare class GuardsService {
    private prisma;
    private auditService;
    private webhooksService;
    private fieldPermissionsService;
    constructor(prisma: PrismaService, auditService: AuditService, webhooksService: WebhooksService, fieldPermissionsService: FieldPermissionsService);
    private normalizeContact;
    private withoutPasswordHash;
    private optionalText;
    private sensitiveGuardData;
    create(user: ActiveUser, dto: CreateGuardDto): Promise<Omit<{
        id: string;
        name: string;
        createdAt: Date;
        documents: string | null;
        email: string | null;
        tenantId: string;
        branchId: string | null;
        phone: string | null;
        passwordHash: string | null;
        salary: number | null;
        bankDetails: string | null;
        personalNotes: string | null;
    }, "passwordHash">>;
    findAll(user: ActiveUser, requestedBranchId?: string | null): Promise<Omit<{
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
        availability: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            status: string;
            startDate: Date | null;
            endDate: Date | null;
            guardId: string;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        documents: string | null;
        email: string | null;
        tenantId: string;
        branchId: string | null;
        phone: string | null;
        passwordHash: string | null;
        salary: number | null;
        bankDetails: string | null;
        personalNotes: string | null;
    }, "passwordHash">[]>;
    findOne(user: ActiveUser, id: string): Promise<Omit<{
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
        availability: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            status: string;
            startDate: Date | null;
            endDate: Date | null;
            guardId: string;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        documents: string | null;
        email: string | null;
        tenantId: string;
        branchId: string | null;
        phone: string | null;
        passwordHash: string | null;
        salary: number | null;
        bankDetails: string | null;
        personalNotes: string | null;
    }, "passwordHash">>;
    update(user: ActiveUser, id: string, dto: UpdateGuardDto): Promise<Omit<{
        id: string;
        name: string;
        createdAt: Date;
        documents: string | null;
        email: string | null;
        tenantId: string;
        branchId: string | null;
        phone: string | null;
        passwordHash: string | null;
        salary: number | null;
        bankDetails: string | null;
        personalNotes: string | null;
    }, "passwordHash">>;
    getAvailability(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        startDate: Date | null;
        endDate: Date | null;
        guardId: string;
    } | {
        status: string;
    }>;
    updateAvailability(user: ActiveUser, id: string, dto: UpdateAvailabilityDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        startDate: Date | null;
        endDate: Date | null;
        guardId: string;
    }>;
}
