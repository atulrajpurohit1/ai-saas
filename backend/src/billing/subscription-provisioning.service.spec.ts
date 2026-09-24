import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuditService } from '../audit/audit.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';

describe('SubscriptionProvisioningService', () => {
  let service: SubscriptionProvisioningService;
  let tx: {
    tenantSubscription: { upsert: jest.Mock };
    tenantModule: {
      findMany: jest.Mock;
      update: jest.Mock;
      createMany: jest.Mock;
    };
  };
  let prisma: {
    $transaction: jest.Mock;
    tenantSubscription: { updateMany: jest.Mock; findFirst: jest.Mock };
  };
  let entitlements: { invalidate: jest.Mock; summaryForTenant: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    tx = {
      tenantSubscription: { upsert: jest.fn().mockResolvedValue({}) },
      tenantModule: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
      tenantSubscription: {
        updateMany: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    entitlements = {
      invalidate: jest.fn(),
      summaryForTenant: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionProvisioningService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(SubscriptionProvisioningService);
  });

  it('creates rows for newly purchased services', async () => {
    await service.provision({
      tenantId: 't1',
      modules: ['LEAD_GEN', 'FINANCE'],
      status: 'ACTIVE',
    });

    expect(tx.tenantModule.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: 't1', module: 'LEAD_GEN', isActive: true },
        { tenantId: 't1', module: 'FINANCE', isActive: true },
      ],
    });
  });

  it('deactivates a service that is no longer purchased', async () => {
    tx.tenantModule.findMany.mockResolvedValue([
      { id: 'm1', module: 'LEAD_GEN', isActive: true },
      { id: 'm2', module: 'GUARD_TOUR', isActive: true },
    ]);

    await service.provision({
      tenantId: 't1',
      modules: ['LEAD_GEN'],
      status: 'ACTIVE',
    });

    expect(tx.tenantModule.update).toHaveBeenCalledWith({
      where: { id: 'm2' },
      data: { isActive: false },
    });
    expect(tx.tenantModule.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' } }),
    );
  });

  // A customer who cancels and comes back should not need new rows.
  it('reactivates a previously deactivated service', async () => {
    tx.tenantModule.findMany.mockResolvedValue([
      { id: 'm1', module: 'GUARD_TOUR', isActive: false },
    ]);

    await service.provision({
      tenantId: 't1',
      modules: ['GUARD_TOUR'],
      status: 'ACTIVE',
    });

    expect(tx.tenantModule.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { isActive: true },
    });
    expect(tx.tenantModule.createMany).not.toHaveBeenCalled();
  });

  it('writes nothing when the desired state already matches', async () => {
    tx.tenantModule.findMany.mockResolvedValue([
      { id: 'm1', module: 'LEAD_GEN', isActive: true },
    ]);

    await service.provision({
      tenantId: 't1',
      modules: ['LEAD_GEN'],
      status: 'ACTIVE',
    });

    expect(tx.tenantModule.update).not.toHaveBeenCalled();
    expect(tx.tenantModule.createMany).not.toHaveBeenCalled();
  });

  // Without this the customer waits up to 30s after paying before their new
  // services appear.
  it('drops the entitlement cache so the purchase takes effect at once', async () => {
    await service.provision({
      tenantId: 't1',
      modules: ['LEAD_GEN'],
      status: 'ACTIVE',
    });

    expect(entitlements.invalidate).toHaveBeenCalledWith('t1');
  });

  // A partial event must not orphan the tenant from its Stripe customer.
  it('never clears an existing provider id with a missing one', async () => {
    await service.provision({
      tenantId: 't1',
      modules: ['LEAD_GEN'],
      status: 'ACTIVE',
    });

    const update = tx.tenantSubscription.upsert.mock.calls[0][0].update as Record<
      string,
      unknown
    >;
    expect(update).not.toHaveProperty('providerCustomerId');
    expect(update).not.toHaveProperty('providerSubscriptionId');
  });

  it('records provider ids when they are supplied', async () => {
    await service.provision({
      tenantId: 't1',
      modules: ['LEAD_GEN'],
      status: 'ACTIVE',
      providerCustomerId: 'cus_1',
      providerSubscriptionId: 'sub_1',
    });

    expect(tx.tenantSubscription.upsert.mock.calls[0][0].update).toEqual(
      expect.objectContaining({
        providerCustomerId: 'cus_1',
        providerSubscriptionId: 'sub_1',
      }),
    );
  });

  // An audit write must never fail a paid provisioning.
  it('still succeeds when the audit log write fails', async () => {
    audit.log.mockRejectedValue(new Error('audit down'));

    await expect(
      service.provision({
        tenantId: 't1',
        modules: ['LEAD_GEN'],
        status: 'ACTIVE',
      }),
    ).resolves.toBeDefined();
  });

  it('applies module changes inside a single transaction', async () => {
    await service.provision({
      tenantId: 't1',
      modules: ['LEAD_GEN'],
      status: 'ACTIVE',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  describe('cancel', () => {
    it('marks the subscription cancelled and clears the cache', async () => {
      await service.cancel('t1', 'stripe:evt_1');

      expect(prisma.tenantSubscription.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        data: { status: 'CANCELED', cancelAtPeriodEnd: false },
      });
      expect(entitlements.invalidate).toHaveBeenCalledWith('t1');
    });
  });

  describe('tenantForProviderIds', () => {
    it('returns null when given nothing to look up', async () => {
      await expect(service.tenantForProviderIds({})).resolves.toBeNull();
      expect(prisma.tenantSubscription.findFirst).not.toHaveBeenCalled();
    });

    it('matches on subscription or customer id', async () => {
      prisma.tenantSubscription.findFirst.mockResolvedValue({
        tenantId: 't9',
      });

      await expect(
        service.tenantForProviderIds({
          customerId: 'cus_1',
          subscriptionId: 'sub_1',
        }),
      ).resolves.toBe('t9');

      expect(prisma.tenantSubscription.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { providerSubscriptionId: 'sub_1' },
            { providerCustomerId: 'cus_1' },
          ],
        },
        select: { tenantId: true },
      });
    });
  });
});
