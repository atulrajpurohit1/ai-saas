import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PlatformRefreshPayload } from '../strategies/jwt-platform-refresh.strategy';

/**
 * The verified platform refresh payload, including the raw token so the
 * service can compare it against the stored hash. Only valid behind
 * AuthGuard('jwt-platform-refresh').
 */
export const GetPlatformRefresh = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformRefreshPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: PlatformRefreshPayload }>();
    return request.user;
  },
);
