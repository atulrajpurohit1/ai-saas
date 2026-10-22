import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActivePlatformAdmin } from '../interfaces/active-platform-admin.interface';

/** The authenticated platform admin. Only valid behind PlatformAdminGuard. */
export const GetPlatformAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActivePlatformAdmin => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: ActivePlatformAdmin }>();
    return request.user;
  },
);
