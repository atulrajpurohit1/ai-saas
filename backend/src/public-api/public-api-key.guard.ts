import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { serviceForPublicApiPermission } from '../api-keys/public-api-permissions';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { SERVICE_MODULE_LABELS } from '../entitlements/entitlements.constants';
import { PUBLIC_API_PERMISSION_KEY } from './public-api.decorator';
import { PublicApiRateLimitService } from './public-api-rate-limit.service';
import { PublicApiRequest } from './public-api.types';

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
    private readonly rateLimitService: PublicApiRateLimitService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicApiRequest>();
    const apiKey = await this.apiKeysService.authenticate(
      this.extractApiKey(request),
    );
    request.publicApiKey = apiKey;
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PUBLIC_API_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      requiredPermission &&
      !apiKey.permissions.includes(requiredPermission)
    ) {
      await this.logDeniedRequest(request, 403);
      throw new ForbiddenException(`API key is missing ${requiredPermission}`);
    }

    // The entitlement check, which the scope check above is NOT a substitute
    // for. A scope only says what the key's owner asked the key to be allowed
    // to do; it says nothing about what the tenant bought. Without this, a
    // tenant could mint a key carrying `guards.write` or `invoices.read` --
    // both legitimate, whitelisted scopes available to every account, since
    // api_keys.manage sits on the CORE `integrations` module -- and run Guard
    // Tour and Operations through /public/* having paid for neither.
    //
    // Enforced here rather than in a second guard so there is no ordering
    // dependency on request.publicApiKey being populated first, and so a
    // denial is logged through the same path as a scope denial.
    await this.assertEntitled(request, apiKey.tenantId, requiredPermission);

    try {
      this.rateLimitService.check(apiKey.id, apiKey.rateLimitPerMinute);
    } catch (error) {
      await this.logDeniedRequest(request, 429);
      throw error;
    }

    await this.apiKeysService.touch(apiKey.id);
    return true;
  }

  /**
   * Refuses a request for a service the tenant has not bought.
   *
   * Core scopes (clients, sites) resolve to null and are always allowed, which
   * matches the web app: those records are read by all three services, so
   * gating them on any one of them would lock out the other two.
   */
  private async assertEntitled(
    request: PublicApiRequest,
    tenantId: string,
    requiredPermission: string | undefined,
  ) {
    if (!requiredPermission) return;

    const service = serviceForPublicApiPermission(requiredPermission);
    if (!service) return;

    if (await this.entitlements.hasModule(tenantId, service)) return;

    await this.logDeniedRequest(request, 403);
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      upgradeRequired: true,
      modules: [service],
      message: `Your plan does not include ${SERVICE_MODULE_LABELS[service]}. Upgrade to enable it.`,
    });
  }

  private extractApiKey(request: PublicApiRequest) {
    const directHeader = request.headers['x-api-key'];
    if (Array.isArray(directHeader)) {
      return directHeader[0];
    }

    if (typeof directHeader === 'string') {
      return directHeader;
    }

    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization)
      ? authorization[0]
      : authorization;
    if (value?.toLowerCase().startsWith('bearer ')) {
      return value.slice(7);
    }

    return undefined;
  }

  private async logDeniedRequest(
    request: PublicApiRequest,
    statusCode: number,
  ) {
    if (!request.publicApiKey) return;

    await this.apiKeysService.logRequest({
      apiKey: request.publicApiKey,
      endpoint: request.originalUrl || request.url || 'unknown',
      method: request.method,
      statusCode,
      ipAddress: this.getIpAddress(request),
      userAgent: this.getHeader(request, 'user-agent'),
    });
  }

  private getIpAddress(request: PublicApiRequest) {
    return (
      this.getHeader(request, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      request.ip ||
      request.socket?.remoteAddress ||
      null
    );
  }

  private getHeader(request: PublicApiRequest, key: string) {
    const value = request.headers[key];
    if (Array.isArray(value)) return value[0];
    return value || null;
  }
}
