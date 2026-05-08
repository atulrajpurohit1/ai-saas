import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AuditService } from '../audit/audit.service';
export declare class ShiftsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(userId: string, tenantId: string, dto: CreateShiftDto): Promise<{
        site: {
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        startTime: Date;
        endTime: Date;
        requiredGuards: number;
        siteId: string;
    }>;
    findAll(tenantId: string): Promise<({
        site: {
            name: string;
        };
        assignments: ({
            guard: {
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            status: string;
            guardId: string;
            shiftId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        startTime: Date;
        endTime: Date;
        requiredGuards: number;
        siteId: string;
    })[]>;
    assign(userId: string, tenantId: string, shiftId: string, guardId: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        guardId: string;
        shiftId: string;
    }>;
    unassign(userId: string, tenantId: string, shiftId: string): Promise<{
        message: string;
    }>;
}
