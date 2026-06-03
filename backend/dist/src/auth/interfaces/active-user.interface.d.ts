export interface ActiveUser {
    sub: string;
    email?: string;
    phone?: string;
    tenantId: string;
    role: 'admin' | 'finance' | 'supervisor' | 'client' | 'guard';
    branchId?: string | null;
    isSuperAdmin?: boolean;
    clientId?: string;
    guardId?: string;
}
