export interface ActiveUser {
  sub: string;
  email?: string;
  phone?: string;
  tenantId: string;
  role: string;
  branchId?: string | null;
  /**
   * TENANT-SCOPED. Means "owner of this tenant, so sees every branch in it",
   * and nothing more. Signup sets it for every tenant's founding user.
   *
   * It is NOT platform authority and must never be used as such. It was, once:
   * the platform guard read this flag, so every tenant owner held a working
   * platform-admin token. The platform console authenticates against the
   * PlatformAdmin table with its own signing secret -- see
   * ActivePlatformAdmin, which is a separate type on purpose.
   */
  isSuperAdmin?: boolean;
  clientId?: string;
  guardId?: string;
  sessionId?: string;
}
