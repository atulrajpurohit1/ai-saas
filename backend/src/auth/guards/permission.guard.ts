import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { ActiveUser } from '../interfaces/active-user.interface';
import { RolesService } from '../../roles/roles.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndMerge<string[]>(
      PERMISSIONS_KEY,
      [context.getClass(), context.getHandler()],
    );
    const anyPermissions = this.reflector.getAllAndMerge<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getClass(), context.getHandler()],
    );

    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!anyPermissions || anyPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const user = request.user as ActiveUser | undefined;

    const hasRequired = await this.rolesService.hasPermissions(
      user,
      requiredPermissions || [],
    );
    if (!hasRequired) return false;
    if (!anyPermissions || anyPermissions.length === 0) return true;

    return this.rolesService.hasAnyPermission(user, anyPermissions);
  }
}
