import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { detectCrm, suggestMapping } from './column-matcher';
import { CrmImportService } from './crm-import.service';

/** Typed wrapper - the bare matcher is `any`, which trips no-unsafe-assignment. */
const containing = (shape: Record<string, unknown>): unknown =>
  expect.objectContaining(shape);

const TENANT = 'tenant-1';
const USER = 'user-1';

describe('column matcher', () => {
  it('maps a HubSpot export', () => {
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Company Name',
      'hs_lead_status',
    ];
    expect(suggestMapping(headers)).toEqual({
      name: 'First Name',
      company: 'Company Name',
      email: 'Email',
      status: 'hs_lead_status',
    });
  });

  it('maps a Pipedrive export with prefixed headers', () => {
    const headers = [
      'Person - Name',
      'Organization - Name',
      'Person - Email',
      'Deal - Stage',
    ];
    expect(suggestMapping(headers)).toEqual({
      name: 'Person - Name',
      company: 'Organization - Name',
      email: 'Person - Email',
      status: 'Deal - Stage',
    });
  });

  it('maps a Salesforce export', () => {
    const headers = [
      'Full Name',
      'Account Name',
      'Email Address',
      'Lead Status',
    ];
    expect(suggestMapping(headers)).toEqual({
      name: 'Full Name',
      company: 'Account Name',
      email: 'Email Address',
      status: 'Lead Status',
    });
  });

  it('never assigns one column to two fields', () => {
    const headers = ['Name', 'Email'];
    const mapping = suggestMapping(headers);
    const used = Object.values(mapping);
    expect(new Set(used).size).toBe(used.length);
    expect(mapping.company).toBeUndefined();
  });

  it('identifies the source CRM when the signature is recognisable', () => {
    expect(
      detectCrm(['Record ID', 'hs_lead_status', 'Associated Company']),
    ).toBe('HubSpot');
    expect(detectCrm(['Name', 'Company'])).toBeNull();
  });
});

describe('CrmImportService', () => {
  let service: CrmImportService;
  let prisma: {
    lead: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const csv = (text: string) => Buffer.from(text, 'utf8');

  beforeEach(async () => {
    prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'lead-1' }),
        update: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CrmImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(CrmImportService);
  });

  describe('preview', () => {
    it('returns headers, sample rows and a suggested mapping', async () => {
      const preview = await service.preview(
        csv(
          'Full Name,Account Name,Email\nAda Lovelace,Analytical Ltd,ada@analytical.io\n',
        ),
      );

      expect(preview.headers).toEqual(['Full Name', 'Account Name', 'Email']);
      expect(preview.totalRows).toBe(1);
      expect(preview.suggestedMapping).toEqual({
        name: 'Full Name',
        company: 'Account Name',
        email: 'Email',
      });
    });

    it('strips the BOM that Excel-exported CSVs start with', async () => {
      const preview = await service.preview(
        csv('﻿Name,Company\nAda,Analytical\n'),
      );
      expect(preview.headers).toEqual(['Name', 'Company']);
      expect(preview.suggestedMapping.name).toBe('Name');
    });

    it('rejects a file with no header row', async () => {
      await expect(service.preview(csv(''))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('writes nothing', async () => {
      await service.preview(csv('Name,Company\nAda,Analytical\n'));
      expect(prisma.lead.create).not.toHaveBeenCalled();
    });
  });

  describe('commit', () => {
    const mapping = { name: 'Name', company: 'Company', email: 'Email' };

    it('creates leads from mapped columns', async () => {
      const result = await service.commit(
        csv(
          'Name,Company,Email\nAda Lovelace,Analytical Ltd,ada@analytical.io\n',
        ),
        mapping,
        TENANT,
        USER,
      );

      expect(result).toMatchObject({
        created: 1,
        updated: 0,
        skipped: 0,
        totalRows: 1,
      });
      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT,
          name: 'Ada Lovelace',
          company: 'Analytical Ltd',
          email: 'ada@analytical.io',
          status: 'new',
        },
      });
    });

    it('updates an existing lead matched on email instead of duplicating it', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'existing-1' });

      const result = await service.commit(
        csv(
          'Name,Company,Email\nAda Lovelace,Analytical Ltd,ada@analytical.io\n',
        ),
        mapping,
        TENANT,
        USER,
      );

      expect(result).toMatchObject({ created: 0, updated: 1 });
      expect(prisma.lead.create).not.toHaveBeenCalled();
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
        data: containing({ name: 'Ada Lovelace' }),
      });
    });

    it('scopes the duplicate lookup to the tenant', async () => {
      await service.commit(
        csv('Name,Company,Email\nAda,Analytical,ada@analytical.io\n'),
        mapping,
        TENANT,
        USER,
      );

      expect(prisma.lead.findFirst).toHaveBeenCalledWith({
        where: { tenantId: TENANT, email: 'ada@analytical.io' },
      });
    });

    it('joins first and last name columns when there is no single name column', async () => {
      const result = await service.commit(
        csv('First Name,Last Name,Company\nAda,Lovelace,Analytical Ltd\n'),
        { company: 'Company' },
        TENANT,
        USER,
      );

      expect(result.created).toBe(1);
      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: containing({ name: 'Ada Lovelace' }),
      });
    });

    it('skips rows missing a required value and reports the line number', async () => {
      const result = await service.commit(
        csv(
          'Name,Company,Email\nAda,Analytical,ada@analytical.io\n,Orphan Co,x@y.io\n',
        ),
        mapping,
        TENANT,
        USER,
      );

      expect(result).toMatchObject({ created: 1, skipped: 1 });
      expect(result.errors).toEqual([{ row: 3, reason: 'Missing a name' }]);
    });

    it('ignores the blank trailing rows CRM exports often end with', async () => {
      const result = await service.commit(
        csv('Name,Company,Email\nAda,Analytical,ada@analytical.io\n,,\n,,\n'),
        mapping,
        TENANT,
        USER,
      );

      expect(result).toMatchObject({ created: 1, skipped: 0, totalRows: 1 });
    });

    it('rejects a mapping that omits a required field', async () => {
      await expect(
        service.commit(
          csv('Name,Email\nAda,ada@analytical.io\n'),
          { name: 'Name' },
          TENANT,
          USER,
        ),
      ).rejects.toThrow(/company/);
    });

    it('rejects a mapping pointing at a column the file does not have', async () => {
      await expect(
        service.commit(
          csv('Name,Company\nAda,Analytical\n'),
          { name: 'Name', company: 'Company', email: 'Nope' },
          TENANT,
          USER,
        ),
      ).rejects.toThrow(/no column for/);
    });

    it('rejects a mapping that targets a field that is not importable', async () => {
      await expect(
        service.commit(
          csv('Name,Company\nAda,Analytical\n'),
          { name: 'Name', company: 'Company', secret: 'Name' } as never,
          TENANT,
          USER,
        ),
      ).rejects.toThrow(/unknown lead fields/);
    });

    it('lowercases an imported status and defaults it when unmapped', async () => {
      await service.commit(
        csv('Name,Company,Stage\nAda,Analytical,QUALIFIED\n'),
        { name: 'Name', company: 'Company', status: 'Stage' },
        TENANT,
        USER,
      );
      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: containing({ status: 'qualified' }),
      });

      prisma.lead.create.mockClear();
      await service.commit(
        csv('Name,Company\nGrace,Compiler Inc\n'),
        { name: 'Name', company: 'Company' },
        TENANT,
        USER,
      );
      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: containing({ status: 'new' }),
      });
    });
  });
});
