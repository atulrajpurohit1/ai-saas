/**
 * What the platform strategy puts on `request.user` for a platform request.
 *
 * Deliberately shaped NOTHING like ActiveUser: no tenantId, no role, no
 * branchId, no permissions. A tenant-scoped service that was handed one of
 * these by mistake fails to compile rather than silently querying with
 * `tenantId: undefined`, which in Prisma would match across all tenants.
 */
export interface ActivePlatformAdmin {
  /** PlatformAdmin.id. */
  adminId: string;
  email: string;
  name: string | null;
  scope: 'platform';
}
