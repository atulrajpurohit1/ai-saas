import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActivePlatformAdmin } from '../interfaces/active-platform-admin.interface';
import { PLATFORM_TOKEN_SCOPE } from '../platform-auth.constants';

/**
 * The only way into the platform console API.
 *
 * Replaces SuperAdminGuard, which trusted the `isSuperAdmin` claim on a TENANT
 * token -- a claim signup handed to every tenant's founding user, so the guard
 * admitted every customer. This one runs the 'jwt-platform' strategy, keyed on
 * a separate secret, so a tenant token fails before any claim is inspected.
 *
 * The scope re-check below is redundant today (the strategy already rejects a
 * wrong scope) and kept anyway: it costs one comparison and means this guard
 * does not depend on a different file continuing to be careful.
 */
@Injectable()
export class PlatformAdminGuard extends AuthGuard('jwt-platform') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = ActivePlatformAdmin>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const admin = user as ActivePlatformAdmin | false | null | undefined;
    if (err || !admin || admin.scope !== PLATFORM_TOKEN_SCOPE) {
      // A 401 and nothing else. The old guard answered 403 "Platform
      // administrator access required", which confirmed to any logged-in
      // tenant that the endpoint was real and that they were merely one flag
      // short. This surface does not acknowledge itself to a caller who
      // cannot authenticate to it.
      return super.handleRequest(err, null as TUser, info, context);
    }
    return admin as TUser;
  }
}
