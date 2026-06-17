import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BillingService } from './billing.service';
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    getBilling(user: ActiveUser): Promise<{
        tenant: {
            id: string;
            slug: string;
            name: string;
            createdAt: Date;
        } | null;
        plan: {
            key: "free" | "starter" | "growth" | "enterprise";
            name: string;
            monthlyPrice: number | null;
            source: string;
        };
        limits: Record<string, any>;
        features: {
            salesAccelerator: boolean;
            salesAutomation: boolean;
            publicApi: boolean;
            customDomains: boolean;
            sso: boolean;
            prioritySupport: boolean;
        };
        availablePlans: {
            key: string;
            name: string;
            monthlyPrice: number | null;
            limits: {
                branches: number | null;
                deals: number | null;
                leads: number | null;
                clientUsers: number | null;
                adminUsers: number | null;
            };
        }[];
    }>;
}
