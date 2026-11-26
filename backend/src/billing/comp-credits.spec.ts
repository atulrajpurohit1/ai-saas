import { CreditEntryType } from '@prisma/client';
import { CompController } from './comp.controller';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from './credits.service';

describe('platform free credit grants', () => {
  const tenant = { findUnique: jest.fn() };
  const grant = jest.fn();
  const controller = new CompController(
    { tenant } as unknown as PrismaService,
    {} as never,
    {} as never,
    { grant } as unknown as CreditsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('adds a ledger adjustment for an existing tenant, with the actor and reason', async () => {
    tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    grant.mockResolvedValue({ balance: 1200, granted: true });

    await expect(
      controller.grantCredits(
        { tenantId: 'tenant-1', amount: 200, reason: '  pilot gift  ' },
        { adminId: 'admin-1' } as never,
      ),
    ).resolves.toEqual({ balance: 1200, granted: true });
    expect(grant).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      amount: 200,
      description: 'Free credit grant by platform admin admin-1: pilot gift',
      type: CreditEntryType.ADJUSTMENT,
    });
  });

  it('refuses an unknown tenant before changing a balance', async () => {
    tenant.findUnique.mockResolvedValue(null);
    await expect(
      controller.grantCredits(
        { tenantId: 'missing', amount: 200, reason: 'pilot gift' },
        { adminId: 'admin-1' } as never,
      ),
    ).rejects.toThrow('Tenant not found');
    expect(grant).not.toHaveBeenCalled();
  });
});
