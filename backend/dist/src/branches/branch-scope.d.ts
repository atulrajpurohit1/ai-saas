import { ActiveUser } from '../auth/interfaces/active-user.interface';
export type BranchAccessScope = {
    tenantId: string;
    requestedBranchId?: string | null;
};
export declare function branchWhere(user: ActiveUser, requestedBranchId?: string | null): {
    branchId: string;
    OR?: undefined;
} | {
    branchId?: undefined;
    OR?: undefined;
} | {
    branchId: null;
    OR?: undefined;
} | {
    OR: ({
        branchId: string;
    } | {
        branchId: null;
    })[];
    branchId?: undefined;
};
export declare function resolveWriteBranchId(user: ActiveUser, requestedBranchId?: string | null): string | null;
export declare function branchScopedWhere(user: ActiveUser, requestedBranchId?: string | null): {
    branchId: string;
    OR?: undefined;
    tenantId: string;
} | {
    branchId?: undefined;
    OR?: undefined;
    tenantId: string;
} | {
    branchId: null;
    OR?: undefined;
    tenantId: string;
} | {
    OR: ({
        branchId: string;
    } | {
        branchId: null;
    })[];
    branchId?: undefined;
    tenantId: string;
};
