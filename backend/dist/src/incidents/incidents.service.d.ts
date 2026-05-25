import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
type IncidentStatus = 'submitted' | 'reviewed' | 'rejected';
export declare class IncidentsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private mapIncident;
    private incidentSelectSql;
    private validateCreateDto;
    createForGuard(tenantId: string, guardId: string, shiftId: string, dto: CreateIncidentDto): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
        occurredAt: Date;
        attachmentUrl: string | null;
        notes: string | null;
        createdAt: Date;
        site: {
            id: string;
            name: string;
            address: string;
        };
        guard: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        };
        shift: {
            id: string;
            startTime: Date;
            endTime: Date;
        };
    }>;
    findForGuard(tenantId: string, guardId: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
        occurredAt: Date;
        attachmentUrl: string | null;
        notes: string | null;
        createdAt: Date;
        site: {
            id: string;
            name: string;
            address: string;
        };
        guard: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        };
        shift: {
            id: string;
            startTime: Date;
            endTime: Date;
        };
    }[]>;
    findAllForAdmin(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
        occurredAt: Date;
        attachmentUrl: string | null;
        notes: string | null;
        createdAt: Date;
        site: {
            id: string;
            name: string;
            address: string;
        };
        guard: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        };
        shift: {
            id: string;
            startTime: Date;
            endTime: Date;
        };
    }[]>;
    findOneForAdmin(tenantId: string, incidentId: string, userId: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
        occurredAt: Date;
        attachmentUrl: string | null;
        notes: string | null;
        createdAt: Date;
        site: {
            id: string;
            name: string;
            address: string;
        };
        guard: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        };
        shift: {
            id: string;
            startTime: Date;
            endTime: Date;
        };
    }>;
}
export {};
