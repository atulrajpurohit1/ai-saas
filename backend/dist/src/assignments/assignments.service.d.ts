import { PrismaService } from '../prisma/prisma.service';
export declare class AssignmentsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(tenantId: string): Promise<({
        guard: {
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
        };
        shift: {
            site: {
                id: string;
                name: string;
                createdAt: Date;
                tenantId: string;
                branchId: string | null;
                clientId: string | null;
                address: string;
                instructions: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            branchId: string | null;
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
