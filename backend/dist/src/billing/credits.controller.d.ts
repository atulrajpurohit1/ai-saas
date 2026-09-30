import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AuditService } from '../audit/audit.service';
import { CreditsService } from './credits.service';
import { GrantCreditsDto } from './dto/grant-credits.dto';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { StripeService } from './stripe.service';
export declare class CreditsController {
    private readonly credits;
    private readonly stripe;
    private readonly audit;
    constructor(credits: CreditsService, stripe: StripeService, audit: AuditService);
    getBalance(user: ActiveUser): Promise<import("./credits.service").CreditBalanceSummary>;
    getPacks(): {
        configured: boolean;
        packs: import("./credit-packs.constants").CreditPack[];
        costs: {
            playbook: number;
            perProspect: number;
        };
    };
    getLedger(user: ActiveUser, limit?: string): Promise<{
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
        stripeSessionId: string | null;
        reservationId: string | null;
    }[]>;
    purchase(user: ActiveUser, dto: PurchaseCreditsDto): Promise<{
        url: string | null;
        sessionId: string;
    }>;
    grant(user: ActiveUser, dto: GrantCreditsDto): Promise<{
        balance: number;
        granted: boolean;
    }>;
}
