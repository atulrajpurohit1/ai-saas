export interface ActiveUser {
    sub: string;
    email?: string;
    phone?: string;
    tenantId: string;
    role: 'admin' | 'client' | 'guard';
    clientId?: string;
    guardId?: string;
}
