import { LeadsService } from './leads.service';

describe('LeadsService CRM delivery', () => {
  it('automatically offers every newly created lead to the GHL connector', async () => {
    const lead = {
      id: 'lead-1',
      tenantId: 'tenant-1',
      name: 'Ada Adams',
      company: 'Adams Security',
      email: 'ada@example.com',
      phone: null,
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      lead: { create: jest.fn().mockResolvedValue(lead) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const crm = {
      autoSyncLeadToGhl: jest
        .fn()
        .mockResolvedValue({ synced: true, result: { externalId: 'ghl-1' } }),
    };
    const service = new LeadsService(
      prisma as never,
      {} as never,
      audit as never,
      {} as never,
      crm as never,
    );

    await expect(
      service.create(
        {
          name: lead.name,
          company: lead.company,
          email: lead.email,
        },
        lead.tenantId,
        'user-1',
      ),
    ).resolves.toBe(lead);

    expect(crm.autoSyncLeadToGhl).toHaveBeenCalledWith(
      lead,
      lead.tenantId,
      'user-1',
    );
  });
});
