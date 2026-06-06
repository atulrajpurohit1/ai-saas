import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { ApiKeysService } from '../api-keys/api-keys.service';
export declare class PublicApiLoggingInterceptor implements NestInterceptor {
    private readonly apiKeysService;
    constructor(apiKeysService: ApiKeysService);
    intercept(context: ExecutionContext, next: CallHandler): import("rxjs").Observable<any>;
    private log;
    private getIpAddress;
    private getHeader;
}
