import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { PlatformMonitoringController } from './platform-monitoring.controller';
import { PlatformMonitoringService } from './platform-monitoring.service';

/**
 * The platform owner's cross-tenant surface. Pairs the read-only monitoring
 * endpoints here with the comp/Trial write actions in BillingModule's
 * CompController -- both gated by SuperAdminGuard. AiModule is imported for the
 * AI cost figures (AiUsageService).
 */
@Module({
  imports: [PrismaModule, AiModule],
  controllers: [PlatformMonitoringController],
  providers: [PlatformMonitoringService],
})
export class PlatformModule {}
