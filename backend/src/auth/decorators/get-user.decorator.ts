import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActiveUser } from '../interfaces/active-user.interface';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ActiveUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
