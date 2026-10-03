import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmConnectorsController } from './crm-connectors.controller';
import { CrmConnectorsService } from './crm-connectors.service';
import { CRM_PROVIDERS } from './providers/crm-provider.interface';
import { CloseProvider } from './providers/close.provider';
import { CopperProvider } from './providers/copper.provider';
import { FreshsalesProvider } from './providers/freshsales.provider';
import { GhlProvider } from './providers/ghl.provider';
import { HubspotProvider } from './providers/hubspot.provider';
import { PipedriveProvider } from './providers/pipedrive.provider';
import { SalesforceProvider } from './providers/salesforce.provider';
import { ZohoProvider } from './providers/zoho.provider';

const PROVIDER_CLASSES = [
  HubspotProvider,
  GhlProvider,
  SalesforceProvider,
  PipedriveProvider,
  ZohoProvider,
  CloseProvider,
  FreshsalesProvider,
  CopperProvider,
];

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CrmConnectorsController],
  providers: [
    CrmConnectorsService,
    ...PROVIDER_CLASSES,
    {
      provide: CRM_PROVIDERS,
      useFactory: (...providers: InstanceType<(typeof PROVIDER_CLASSES)[number]>[]) =>
        providers,
      inject: [...PROVIDER_CLASSES],
    },
  ],
})
export class CrmConnectorsModule {}
