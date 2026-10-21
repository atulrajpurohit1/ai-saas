import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ActiveUser } from '../interfaces/active-user.interface';

/**
 * Restricts a route to platform super admins.
 *
 * Every other guard in this codebase answers "may this user do X inside their
 * own tenant". This one is different: it gates actions taken ACROSS tenants by
 * whoever runs the platform -- granting a tenant free access, for instance.
 * Tenant-scoped permissions are the wrong tool for that, because a tenant
 * admin legitimately holds `billing.manage` for their own account and must
 * never be able to comp it.
 *
 * `isSuperAdmin` already travels in the JWT but, until this guard, nothing
 * enforced it anywhere. Treat a missing flag as false: the claim is optional
 * on the token, and an absent claim must never read as permission.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const user = request.user as ActiveUser | undefined;

    if (user?.isSuperAdmin !== true) {
      throw new ForbiddenException('Platform administrator access required.');
    }

    return true;
  }
}
