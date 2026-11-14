import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_WITHOUT_PLAN_KEY } from '../decorators/allow-without-plan.decorator';
import { ActiveUser } from '../interfaces/active-user.interface';
import { EntitlementsService } from '../../entitlements/entitlements.service';

/**
 * Refuses every request from a tenant with no active plan.
 *
 * This is the "a plan is required to use the product" rule. ModuleGuard answers
 * a narrower question -- "did they buy THIS service?" -- and by design waves
 * through the CORE modules (clients, sites, documents, notes, activities,
 * branches, integrations, users, roles, dashboard, audit), because those are
 * shared by all three services. The effect was that an account which had
 * bought nothing still got a usable CRM: clients, sites, documents, team
 * members, API keys and webhooks. This guard closes that.
 *
 * Runs AFTER JwtAuthGuard (so `request.user` is populated) and BEFORE the
 * permission/module guards, so a no-plan tenant gets one clear "buy a plan"
 * answer rather than a permission error that looks like a bug.
 *
 * Fails CLOSED: it defers entirely to EntitlementsService, which already
 * treats a missing subscription row, a non-active status and a lapsed comp as
 * "no modules". A tenant it cannot evaluate does not get in.
 *
 * Deliberately NOT a global guard: global guards run before controller-scoped
 * ones, so `request.user` would not exist yet. It is wired per controller
 * instead, and `plan-coverage.spec.ts` fails the build if a tenant-facing
 * controller is added without it.
 */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const exempt = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WITHOUT_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (exempt) return true;

    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();

    const tenantId = this.tenantIdOf(request);

    // No tenant in context: an unauthenticated route, or one authenticated by
    // a mechanism this guard does not understand. Nothing to evaluate, and the
    // route's own guards still apply. Returning true here is safe because the
    // guard is only ever wired behind an authentication guard.
    if (!tenantId) return true;

    if (await this.entitlements.hasAnyPlan(tenantId)) return true;

    // `planRequired` is distinct from ModuleGuard's `upgradeRequired`: the
    // frontend shows "choose a plan" for this and "upgrade to add <service>"
    // for that. Both are kept so existing clients that only know
    // `upgradeRequired` still route to the plan page rather than showing a raw
    // permission error.
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      upgradeRequired: true,
      planRequired: true,
      message:
        'Your account does not have an active plan. Choose a plan to start using AegisLead.',
    });
  }

  /**
   * The tenant this request acts on.
   *
   * Covers the JWT users (staff, guards, clients) and public API keys. Both
   * shapes are checked because PlanGuard sits on controllers behind either
   * mechanism, and a key-authenticated request carries no `user`.
   */
  private tenantIdOf(request: Record<string, unknown>): string | null {
    const user = request.user as ActiveUser | undefined;
    if (user?.tenantId) return user.tenantId;

    const apiKey = request.publicApiKey as { tenantId?: string } | undefined;
    if (apiKey?.tenantId) return apiKey.tenantId;

    return null;
  }
}
