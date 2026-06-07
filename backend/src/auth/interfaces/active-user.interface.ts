export interface ActiveUser {
  sub: string;
  email?: string;
  phone?: string;
  tenantId: string;
  role: string;
  branchId?: string | null;
  isSuperAdmin?: boolean;
  clientId?: string;
  guardId?: string;
  sessionId?: string;
}
