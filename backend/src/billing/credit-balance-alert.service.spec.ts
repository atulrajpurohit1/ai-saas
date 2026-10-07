import { ConfigService } from '@nestjs/config';
import { CreditAlertTier, UserRole } from '@prisma/client';
import { CreditBalanceAlertService } from './credit-balance-alert.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

function build(options: {
  balances?: Array<{ tenantId: string; balance: number }>;
  users?: Array<{ email: string }>;
  openAlert?: { id: string } | null;
  config?: Record<string, string>;
  sendImpl?: jest.Mock;
} = {}) {
  const {
    balances = [{ tenantId: 't1', balance: 100 }],
    users = [{ email: 'admin@example.com' }],
    openAlert = null,
    config = {},
  } = options;

  const createAlert = jest.fn().mockResolvedValue({ id: 'a1' });
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const findFirst = jest.fn().mockResolvedValue(openAlert);

  const prisma = {
    tenantCreditBalance: { findMany: jest.fn().mockResolvedValue(balances) },
    user: { findMany: jest.fn().mockResolvedValue(users) },
    creditBalanceAlert: { findFirst, create: createAlert, updateMany },
  } as unknown as PrismaService;

  const send = options.sendImpl ?? jest.fn().mockResolvedValue({ messageId: 'm' });
  const email = { sendCreditBalanceAlertEmail: send } as unknown as EmailService;
  const configService = {
    get: jest.fn((k: string) => config[k]),
  } as unknown as ConfigService;

  return {
    service: new CreditBalanceAlertService(prisma, email, configService),
    send,
    createAlert,
    updateMany,
    findFirst,
    prisma,
  };
}

describe('CreditBalanceAlertService thresholds', () => {
  it('sends a LOW alert when the balance is at or under the threshold', async () => {
    const { service, send } = build({
      balances: [{ tenantId: 't1', balance: 400 }],
      config: { CREDIT_LOW_BALANCE_THRESHOLD: '500' },
    });
    const outcome = await service.sweep();

    expect(outcome.alertsSent).toBe(1);
    expect(send.mock.calls[0][1].tier).toBe(CreditAlertTier.LOW);
    expect(send.mock.calls[0][1].balance).toBe(400);
  });

  it('sends DEPLETED rather than LOW at zero', async () => {
    const { service, send } = build({
      balances: [{ tenantId: 't1', balance: 0 }],
      config: { CREDIT_LOW_BALANCE_THRESHOLD: '500' },
    });
    await service.sweep();
    expect(send.mock.calls[0][1].tier).toBe(CreditAlertTier.DEPLETED);
  });

  it('sends nothing for a healthy balance', async () => {
    const { service, send } = build({
      balances: [{ tenantId: 't1', balance: 5000 }],
      config: { CREDIT_LOW_BALANCE_THRESHOLD: '500' },
    });
    const outcome = await service.sweep();
    expect(send).not.toHaveBeenCalled();
    expect(outcome.alertsSent).toBe(0);
  });

  it('honours a configured threshold over the default', () => {
    const { service } = build({ config: { CREDIT_LOW_BALANCE_THRESHOLD: '1234' } });
    expect(service.lowThreshold()).toBe(1234);
  });

  it('falls back to a sane default when the threshold is unset', () => {
    const { service } = build();
    expect(service.lowThreshold()).toBeGreaterThan(0);
  });
});

describe('CreditBalanceAlertService deduplication', () => {
  it('does not re-send while an alert of that tier is still open', async () => {
    const { service, send, createAlert } = build({
      balances: [{ tenantId: 't1', balance: 10 }],
      openAlert: { id: 'existing' },
    });
    const outcome = await service.sweep();

    expect(send).not.toHaveBeenCalled();
    expect(createAlert).not.toHaveBeenCalled();
    expect(outcome.alertsSent).toBe(0);
  });

  // The row is written before the send so an SMTP failure cannot turn into an
  // hourly mail loop.
  it('records the alert before sending the email', async () => {
    const order: string[] = [];
    const { service } = build({
      balances: [{ tenantId: 't1', balance: 10 }],
      sendImpl: jest.fn().mockImplementation(() => {
        order.push('send');
        return Promise.resolve({ messageId: 'm' });
      }),
    });
    (service as any).prisma.creditBalanceAlert.create = jest
      .fn()
      .mockImplementation(() => {
        order.push('create');
        return Promise.resolve({ id: 'a1' });
      });

    await service.sweep();
    expect(order).toEqual(['create', 'send']);
  });

  it('clears a recovered alert so the next drain notifies again', async () => {
    const { service, updateMany } = build({
      balances: [{ tenantId: 't1', balance: 9999 }],
      config: { CREDIT_LOW_BALANCE_THRESHOLD: '500' },
    });
    updateMany.mockResolvedValue({ count: 2 });

    const outcome = await service.sweep();
    expect(outcome.alertsCleared).toBe(2);
    const where = updateMany.mock.calls[0][0].where;
    expect(where.clearedAt).toBeNull();
    expect(where.tier.in).toEqual(
      expect.arrayContaining([CreditAlertTier.DEPLETED, CreditAlertTier.LOW]),
    );
  });

  it('clears only DEPLETED when the balance recovers but is still low', async () => {
    const { service, updateMany } = build({
      balances: [{ tenantId: 't1', balance: 100 }],
      config: { CREDIT_LOW_BALANCE_THRESHOLD: '500' },
    });
    await service.sweep();
    expect(updateMany.mock.calls[0][0].where.tier.in).toEqual([
      CreditAlertTier.DEPLETED,
    ]);
  });
});

describe('CreditBalanceAlertService recipients', () => {
  it('only considers tenants who have ever purchased credits', async () => {
    const { service, prisma } = build();
    await service.sweep();
    expect(
      (prisma.tenantCreditBalance.findMany as jest.Mock).mock.calls[0][0].where,
    ).toEqual({ lifetimePurchased: { gt: 0 } });
  });

  it('targets verified ADMIN and FINANCE contacts', async () => {
    const { service, prisma } = build({
      balances: [{ tenantId: 't1', balance: 10 }],
    });
    await service.sweep();
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.role.in).toEqual([UserRole.ADMIN, UserRole.FINANCE]);
    expect(where.emailVerified).toBe(true);
  });

  it('skips a tenant with no billing contact instead of throwing', async () => {
    const { service, send } = build({
      balances: [{ tenantId: 't1', balance: 10 }],
      users: [],
    });
    const outcome = await service.sweep();
    expect(send).not.toHaveBeenCalled();
    expect(outcome.failures).toBe(0);
  });

  it('keeps sweeping after one tenant fails', async () => {
    const { service, send } = build({
      balances: [
        { tenantId: 't1', balance: 10 },
        { tenantId: 't2', balance: 10 },
      ],
      sendImpl: jest
        .fn()
        .mockRejectedValueOnce(new Error('smtp down'))
        .mockResolvedValueOnce({ messageId: 'm' }),
    });

    const outcome = await service.sweep();
    expect(send).toHaveBeenCalledTimes(2);
    expect(outcome.failures).toBe(1);
    expect(outcome.alertsSent).toBe(1);
    expect(outcome.tenantsChecked).toBe(2);
  });
});
