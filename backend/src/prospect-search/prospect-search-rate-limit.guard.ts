import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ProspectSearchRateLimitService } from './prospect-search-rate-limit.service';

@Injectable()
export class ProspectSearchRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: ProspectSearchRateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: ActiveUser }>();

    this.rateLimitService.check(request.user?.sub || 'anonymous');
    return true;
  }
}
