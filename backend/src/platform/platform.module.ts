import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { RolesModule } from '../roles/roles.module';
import { PlatformAuthModule } from '../platform-auth/platform-auth.module';
import { EmailModule } from '../email/email.module';
import { PlatformMonitoringController } from './platform-monitoring.controller';
import { PlatformMonitoringService } from './platform-monitoring.service';
import { TenantAdminController } from './tenant-admin.controller';
import { TenantAdminService } from './tenant-admin.service';

/**
 * The platform owner's cross-tenant surface: read-only monitoring, tenant
 * lifecycle (create/suspend/delete), and -- in BillingModule's CompController
 * -- the comp/Trial write actions. Everything is gated by PlatformAdminGuard,
 * which needs a token signed with the platform secret, so none of it is
 * reachable from a tenant session.
 *
 * PlatformAuthModule is imported for that guard and its strategy; RolesModule
 * seeds a newly created tenant's system roles; AiModule supplies the AI cost
 * figures (AiUsageService).
 */
@Module({
  imports: [PrismaModule, AiModule, RolesModule, PlatformAuthModule, EmailModule],
  controllers: [PlatformMonitoringController, TenantAdminController],
  providers: [PlatformMonitoringService, TenantAdminService],
})
export class PlatformModule {}
