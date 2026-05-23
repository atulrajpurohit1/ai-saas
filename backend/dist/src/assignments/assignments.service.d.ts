import { PrismaService } from '../prisma/prisma.service';
export declare class AssignmentsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(tenantId: string): Promise<({
        guard: {
            id: string;
            name: string;
            createdAt: Date;
            email: string | null;
            tenantId: string;
            phone: string | null;
            passwordHash: string | null;
        };
        shift: {
            site: {
                id: string;
                name: string;
                createdAt: Date;
                tenantId: string;
                address: string;
                instructions: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: string;
            siteId: string;
            startTime: Date;
            endTime: Date;
            requiredGuards: number;
        };
    } & {
        id: string;
        createdAt: Date;
        status: string;
        guardId: string;
        shiftId: string;
    })[]>;
}
