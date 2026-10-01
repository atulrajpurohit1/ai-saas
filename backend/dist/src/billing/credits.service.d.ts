import { CreditEntryType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export interface CreditReservation {
    reservationId: string;
    reserved: number;
    balanceAfter: number;
}
export interface CreditBalanceSummary {
    balance: number;
    lifetimePurchased: number;
    lifetimeConsumed: number;
    reservedPending: number;
}
export declare class CreditsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getBalance(tenantId: string): Promise<CreditBalanceSummary>;
    hasCredits(tenantId: string, required: number): Promise<boolean>;
    reserve(params: {
        tenantId: string;
        jobId: string;
        amount: number;
        description: string;
        userId?: string;
    }): Promise<CreditReservation>;
    settle(params: {
        reservationId: string;
        actualUsed: number;
        description?: string;
        upstreamCostUsd?: number | null;
    }): Promise<{
        released: number;
        consumed: number;
    } | null>;
    findReservation(tenantId: string, jobId: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        description: string;
        userId: string | null;
        amount: number;
        type: import(".prisma/client").$Enums.CreditEntryType;
        balanceAfter: number;
        jobId: string | null;
        reservationStatus: import(".prisma/client").$Enums.CreditReservationStatus | null;
        settledAmount: number | null;
        settledAt: Date | null;
        upstreamCostUsd: Prisma.Decimal | null;
        stripeSessionId: string | null;
        reservationId: string | null;
    } | null>;
    releaseFully(reservationId: string, description?: string): Promise<{
        released: number;
        consumed: number;
    } | null>;
    grant(params: {
        tenantId: string;
        amount: number;
        description: string;
        stripeSessionId?: string;
        userId?: string;
        type?: CreditEntryType;
    }): Promise<{
        balance: number;
        granted: boolean;
    }>;
    reversePurchase(params: {
        tenantId: string;
        stripeSessionId: string;
        reason: string;
    }): Promise<{
        reversed: number;
        balance: number;
    } | null>;
    getLedger(tenantId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        description: string;
        userId: string | null;
        amount: number;
        type: import(".prisma/client").$Enums.CreditEntryType;
        balanceAfter: number;
        jobId: string | null;
        reservationStatus: import(".prisma/client").$Enums.CreditReservationStatus | null;
        settledAmount: number | null;
        settledAt: Date | null;
        upstreamCostUsd: Prisma.Decimal | null;
        stripeSessionId: string | null;
        reservationId: string | null;
    }[]>;
    expireStaleReservations(olderThanMinutes?: number): Promise<{
        expired: number;
        released: number;
    }>;
}
