import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServiceModule } from '@prisma/client';
import { SERVICE_MODULES_KEY } from '../decorators/module.decorator';
import { ActiveUser } from '../interfaces/active-user.interface';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import { SERVICE_MODULE_LABELS } from '../../entitlements/entitlements.constants';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndMerge<ServiceModule[]>(
      SERVICE_MODULES_KEY,
      [context.getClass(), context.getHandler()],
    );

    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const user = request.user as ActiveUser | undefined;

    if (!user?.tenantId) return false;

    const allowed = await this.entitlements.hasAnyModule(
      user.tenantId,
      required,
    );

    if (!allowed) {
      const names = required
        .map((module) => SERVICE_MODULE_LABELS[module])
        .join(' or ');

      // A distinct, actionable message: this is an upsell, not a bug. The
      // frontend keys off `upgradeRequired` to route to the plan page rather
      // than showing a generic permission error.
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        upgradeRequired: true,
        modules: required,
        message: `Your plan does not include ${names}. Upgrade to enable it.`,
      });
    }

    return true;
  }
}
