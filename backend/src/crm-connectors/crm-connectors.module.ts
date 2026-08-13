import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmConnectorsController } from './crm-connectors.controller';
import { CrmConnectorsService } from './crm-connectors.service';
import { CRM_PROVIDERS } from './providers/crm-provider.interface';
import { GhlProvider } from './providers/ghl.provider';
import { HubspotProvider } from './providers/hubspot.provider';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CrmConnectorsController],
  providers: [
    CrmConnectorsService,
    HubspotProvider,
    GhlProvider,
    {
      provide: CRM_PROVIDERS,
      useFactory: (hubspot: HubspotProvider, ghl: GhlProvider) => [hubspot, ghl],
      inject: [HubspotProvider, GhlProvider],
    },
  ],
})
export class CrmConnectorsModule {}
