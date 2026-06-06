import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, tap, throwError } from 'rxjs';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { PublicApiRequest } from './public-api.types';

@Injectable()
export class PublicApiLoggingInterceptor implements NestInterceptor {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const request = http.getRequest<PublicApiRequest>();
    const response = http.getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      tap(() => {
        void this.log(request, response.statusCode || 200);
      }),
      catchError((error) => {
        const statusCode =
          typeof error?.getStatus === 'function'
            ? error.getStatus()
            : error?.status || 500;
        void this.log(request, statusCode);
        return throwError(() => error);
      }),
    );
  }

  private async log(request: PublicApiRequest, statusCode: number) {
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
