import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PublicApiController } from './public-api.controller';
import { PublicApiKeyGuard } from './public-api-key.guard';
import { PublicApiLoggingInterceptor } from './public-api-logging.interceptor';
import { PublicApiRateLimitService } from './public-api-rate-limit.service';
import { PublicApiService } from './public-api.service';

@Module({
  imports: [PrismaModule, AuditModule, ApiKeysModule, WebhooksModule],
  controllers: [PublicApiController],
  providers: [
    PublicApiService,
    PublicApiKeyGuard,
    PublicApiLoggingInterceptor,
    PublicApiRateLimitService,
  ],
})
export class PublicApiModule {}
