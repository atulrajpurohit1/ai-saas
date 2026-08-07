import { PrismaService } from '../prisma/prisma.service';
export declare class ProspectSearchHistoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    record(input: {
        tenantId: string;
        userId: string;
        prompt: string;
        provider: string;
        resultCount: number;
    }): Promise<{
        id: string;
        tenantId: string;
        userId: string;
        provider: string;
        prompt: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
        resultCount: number;
        searchedAt: Date;
    }>;
    list(tenantId: string, userId: string, limit?: number): Promise<{
        id: string;
        tenantId: string;
        userId: string;
        provider: string;
        prompt: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
        resultCount: number;
        searchedAt: Date;
    }[]>;
}
