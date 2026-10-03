import { Test } from '@nestjs/testing';
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
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const CLASSES = [HubspotProvider, GhlProvider, SalesforceProvider, PipedriveProvider, ZohoProvider, CloseProvider, FreshsalesProvider, CopperProvider];

describe('CRM provider registry', () => {
  let service: CrmConnectorsService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CrmConnectorsService,
        ...CLASSES,
        { provide: PrismaService, useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: CRM_PROVIDERS,
          useFactory: (...p: any[]) => p,
          inject: [...CLASSES],
        },
      ],
    }).compile();
    service = moduleRef.get(CrmConnectorsService);
  });

  it('registers all eight providers with unique keys', () => {
    const list = service.listProviders();
    expect(list).toHaveLength(8);
    expect(new Set(list.map((p) => p.key)).size).toBe(8);
  });

  it('marks the api_key providers connectable without operator setup', () => {
    const list = service.listProviders();
    for (const key of ['close', 'freshsales', 'copper']) {
      const found = list.find((p) => p.key === key)!;
      expect(found.auth_kind).toBe('api_key');
      expect(found.configured).toBe(true);
      expect(found.credential_fields.length).toBeGreaterThan(0);
    }
  });

  it('gives every provider setup guidance and a docs link for the UI', () => {
    for (const provider of service.listProviders()) {
      expect(provider.setup_steps.length).toBeGreaterThan(0);
      expect(provider.docs_url).toMatch(/^https:\/\//);
    }
  });

  it('marks oauth providers unconfigured when env vars are absent', () => {
    const list = service.listProviders();
    const sf = list.find((p) => p.key === 'salesforce')!;
    expect(sf.auth_kind).toBe('oauth');
    expect(sf.configured).toBe(false);
    expect(sf.credential_fields).toHaveLength(0);
  });
});
