import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
export declare class GuardsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private normalizeContact;
    private withoutPasswordHash;
    create(userId: string, tenantId: string, dto: CreateGuardDto): Promise<Omit<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        tenantId: string;
        phone: string | null;
        passwordHash: string | null;
    }, "passwordHash">>;
    findAll(tenantId: string): Promise<Omit<{
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
        email: string | null;
        tenantId: string;
        phone: string | null;
        passwordHash: string | null;
    }, "passwordHash">[]>;
    update(userId: string, tenantId: string, id: string, dto: UpdateGuardDto): Promise<Omit<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        tenantId: string;
        phone: string | null;
        passwordHash: string | null;
    }, "passwordHash">>;
    getAvailability(tenantId: string, id: string): Promise<{
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
    updateAvailability(userId: string, tenantId: string, id: string, dto: UpdateAvailabilityDto): Promise<{
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
