import { SetMetadata } from '@nestjs/common';
import { ServiceModule } from '@prisma/client';

export const SERVICE_MODULES_KEY = 'service_modules';

/**
 * Gates a controller or route on the tenant having PURCHASED a service,
 * independently of whether the user's role grants the permission.
 *
 * Entitlement and permission are deliberately separate: a Super Admin at a
 * Lead-Gen-only tenant legitimately holds `guards.view` as a role, but must
 * still be denied Guard Tour. Keeping them apart means adding a service later
 * is one row, not a role migration across every user.
 */
export const RequireModule = (...modules: ServiceModule[]) =>
  SetMetadata(SERVICE_MODULES_KEY, modules);
