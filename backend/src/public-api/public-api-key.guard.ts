import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { PUBLIC_API_PERMISSION_KEY } from './public-api.decorator';
import { PublicApiRateLimitService } from './public-api-rate-limit.service';
import { PublicApiRequest } from './public-api.types';

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
    private readonly rateLimitService: PublicApiRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicApiRequest>();
    const apiKey = await this.apiKeysService.authenticate(this.extractApiKey(request));
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

    try {
      this.rateLimitService.check(apiKey.id, apiKey.rateLimitPerMinute);
    } catch (error) {
      await this.logDeniedRequest(request, 429);
      throw error;
    }

    await this.apiKeysService.touch(apiKey.id);
    return true;
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
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    if (value?.toLowerCase().startsWith('bearer ')) {
      return value.slice(7);
    }

    return undefined;
  }

  private async logDeniedRequest(request: PublicApiRequest, statusCode: number) {
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
    return this.getHeader(request, 'x-forwarded-for')?.split(',')[0]?.trim()
      || request.ip
      || request.socket?.remoteAddress
      || null;
  }

  private getHeader(request: PublicApiRequest, key: string) {
    const value = request.headers[key];
    if (Array.isArray(value)) return value[0];
    return value || null;
  }
}
