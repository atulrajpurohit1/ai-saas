import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class GuardPortalService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    getProfile(tenantId: string, guardId: string): Promise<{
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        availabilityStatus: string;
    }>;
    getAssignedShifts(tenantId: string, guardId: string): Promise<{
        id: string;
        shiftId: string;
        siteName: string;
        siteAddress: string;
        startTime: Date;
        endTime: Date;
        status: string;
        assignmentStatus: string;
    }[]>;
    getShiftDetail(tenantId: string, guardId: string, shiftId: string): Promise<{
        id: string;
        shiftId: string;
        startTime: Date;
        endTime: Date;
        status: string;
        assignmentStatus: string;
        site: {
            id: string;
            name: string;
            address: string;
            instructions: string | null;
        };
        assignedGuard: {
            id: string;
            name: string;
            phone: string | null;
            email: string | null;
        };
    }>;
}
