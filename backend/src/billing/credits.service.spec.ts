import { BadRequestException } from '@nestjs/common';
import { CreditEntryType, CreditReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from './credits.service';
import { InsufficientCreditsException } from './insufficient-credits.exception';

describe('CreditsService', () => {
  let service: CreditsService;
  let tx: {
    tenantCreditBalance: {
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
    creditLedgerEntry: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let prisma: {
    $transaction: jest.Mock;
    tenantCreditBalance: { findUnique: jest.Mock };
    creditLedgerEntry: {
      aggregate: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  const tenantId = 'tenant-1';

  beforeEach(() => {
    tx = {
      tenantCreditBalance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ balance: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 90 }),
        update: jest.fn().mockResolvedValue({ balance: 95 }),
        upsert: jest.fn().mockResolvedValue({ balance: 250 }),
      },
      creditLedgerEntry: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) =>
        fn(tx),
      ),
      tenantCreditBalance: { findUnique: jest.fn() },
      creditLedgerEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };

    service = new CreditsService(prisma as unknown as PrismaService);
  });

  describe('reserve', () => {
    it('decrements the balance and writes a pending reservation row', async () => {
      const result = await service.reserve({
        tenantId,
        jobId: 'job-1',
        amount: 10,
        description: 'Prospect discovery',
        userId: 'user-1',
      });

      expect(tx.tenantCreditBalance.updateMany).toHaveBeenCalledWith({
        where: { tenantId, balance: { gte: 10 } },
        data: { balance: { decrement: 10 } },
      });
      expect(tx.creditLedgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: CreditEntryType.RESERVATION,
            // Stored negative so the balance is always the ledger's sum.
            amount: -10,
            jobId: 'job-1',
            reservationStatus: CreditReservationStatus.PENDING,
          }),
        }),
      );
      expect(result).toEqual({
        reservationId: 'ledger-1',
        reserved: 10,
        balanceAfter: 90,
      });
    });

    it('throws 402 without holding anything when the balance is too low', async () => {
      // The conditional update matching no rows is exactly how an unaffordable
      // reservation presents itself.
      tx.tenantCreditBalance.updateMany.mockResolvedValue({ count: 0 });
      tx.tenantCreditBalance.findUnique.mockResolvedValue({ balance: 3 });

      await expect(
        service.reserve({
          tenantId,
          jobId: 'job-1',
          amount: 10,
          description: 'Prospect discovery',
        }),
      ).rejects.toBeInstanceOf(InsufficientCreditsException);

      expect(tx.creditLedgerEntry.create).not.toHaveBeenCalled();
    });

    it('rejects a non-positive amount', async () => {
      await expect(
        service.reserve({
          tenantId,
          jobId: 'job-1',
          amount: 0,
          description: 'nothing',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('settle', () => {
    const pendingReservation = {
      id: 'reservation-1',
      tenantId,
      type: CreditEntryType.RESERVATION,
      amount: -20,
      balanceAfter: 80,
      userId: 'user-1',
      jobId: 'job-1',
      reservationStatus: CreditReservationStatus.PENDING,
    };

    it('returns the unused remainder and charges only what was used', async () => {
      tx.creditLedgerEntry.findUnique.mockResolvedValue(pendingReservation);

      const result = await service.settle({
        reservationId: 'reservation-1',
        actualUsed: 3,
      });

      expect(result).toEqual({ released: 17, consumed: 3 });

      // 17 credits go back to the spendable balance.
      expect(tx.tenantCreditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: { increment: 17 } },
        }),
      );
      // Only the 3 actually used count toward lifetime consumption.
      expect(tx.tenantCreditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { lifetimeConsumed: { increment: 3 } },
        }),
      );
      expect(tx.creditLedgerEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationStatus: CreditReservationStatus.SETTLED,
            settledAmount: 3,
          }),
        }),
      );
    });

    it('refunds a failed job in full and marks it released', async () => {
      tx.creditLedgerEntry.findUnique.mockResolvedValue(pendingReservation);

      const result = await service.settle({
        reservationId: 'reservation-1',
        actualUsed: 0,
      });

      expect(result).toEqual({ released: 20, consumed: 0 });
      expect(tx.tenantCreditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { balance: { increment: 20 } } }),
      );
      expect(tx.creditLedgerEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationStatus: CreditReservationStatus.RELEASED,
            settledAmount: 0,
          }),
        }),
      );
    });

    it('never charges more than was held', async () => {
      tx.creditLedgerEntry.findUnique.mockResolvedValue(pendingReservation);

      // BlackPearl returning more than the limit we reserved against must not
      // overdraw the customer -- we absorb the difference.
      const result = await service.settle({
        reservationId: 'reservation-1',
        actualUsed: 50,
      });

      expect(result).toEqual({ released: 0, consumed: 20 });
      expect(tx.tenantCreditBalance.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: expect.anything() }),
        }),
      );
    });

    it('is idempotent: a second settle refunds nothing', async () => {
      tx.creditLedgerEntry.findUnique.mockResolvedValue({
        ...pendingReservation,
        reservationStatus: CreditReservationStatus.SETTLED,
      });

      const result = await service.settle({
        reservationId: 'reservation-1',
        actualUsed: 3,
      });

      expect(result).toBeNull();
      expect(tx.tenantCreditBalance.update).not.toHaveBeenCalled();
      expect(tx.creditLedgerEntry.create).not.toHaveBeenCalled();
    });

    it('ignores an id that is not a reservation', async () => {
      tx.creditLedgerEntry.findUnique.mockResolvedValue({
        ...pendingReservation,
        type: CreditEntryType.PURCHASE,
      });

      await expect(
        service.settle({ reservationId: 'ledger-9', actualUsed: 1 }),
      ).resolves.toBeNull();
    });
  });

  describe('grant', () => {
    it('adds credits and records the purchase against its Stripe session', async () => {
      const result = await service.grant({
        tenantId,
        amount: 250,
        description: 'Starter Pack',
        stripeSessionId: 'cs_test_1',
      });

      expect(result).toEqual({ balance: 250, granted: true });
      expect(tx.creditLedgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: CreditEntryType.PURCHASE,
            amount: 250,
            stripeSessionId: 'cs_test_1',
          }),
        }),
      );
    });

    it('does not count a negative adjustment as a purchase', async () => {
      await service.grant({
        tenantId,
        amount: -50,
        description: 'Correction',
        type: CreditEntryType.ADJUSTMENT,
      });

      expect(tx.tenantCreditBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { balance: { increment: -50 } },
        }),
      );
    });

    it('rejects a zero grant', async () => {
      await expect(
        service.grant({ tenantId, amount: 0, description: 'nothing' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getBalance', () => {
    it('reports held credits as a positive pending figure', async () => {
      prisma.tenantCreditBalance.findUnique.mockResolvedValue({
        balance: 40,
        lifetimePurchased: 100,
        lifetimeConsumed: 60,
      });
      // Reservations are stored negative.
      prisma.creditLedgerEntry.aggregate.mockResolvedValue({
        _sum: { amount: -15 },
      });

      await expect(service.getBalance(tenantId)).resolves.toEqual({
        balance: 40,
        lifetimePurchased: 100,
        lifetimeConsumed: 60,
        reservedPending: 15,
      });
    });

    it('reports zeroes for a tenant that has never bought credits', async () => {
      prisma.tenantCreditBalance.findUnique.mockResolvedValue(null);

      await expect(service.getBalance(tenantId)).resolves.toEqual({
        balance: 0,
        lifetimePurchased: 0,
        lifetimeConsumed: 0,
        reservedPending: 0,
      });
    });
  });
  describe('reversePurchase', () => {
    const purchase = {
      id: 'ledger-purchase',
      tenantId,
      type: CreditEntryType.PURCHASE,
      amount: 1000,
      balanceAfter: 1000,
      stripeSessionId: 'cs_1',
    };

    it('deducts what was granted and records the reversal', async () => {
      prisma.creditLedgerEntry.findUnique.mockResolvedValue(purchase);
      tx.tenantCreditBalance.update.mockResolvedValue({ balance: -200 });

      const result = await service.reversePurchase({
        tenantId,
        stripeSessionId: 'cs_1',
        reason: 'Refunded',
      });

      expect(result).toEqual({ reversed: 1000, balance: -200 });
      expect(tx.tenantCreditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            balance: { decrement: 1000 },
            lifetimePurchased: { decrement: 1000 },
          },
        }),
      );
      // Namespaced so the reversal row cannot collide with the purchase row.
      expect(tx.creditLedgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: -1000,
            stripeSessionId: 'refund:cs_1',
          }),
        }),
      );
    });

    // The customer may already have spent them; refusing to go negative would
    // hand them free usage.
    it('allows the balance to go negative', async () => {
      prisma.creditLedgerEntry.findUnique.mockResolvedValue(purchase);
      tx.tenantCreditBalance.update.mockResolvedValue({ balance: -800 });

      const result = await service.reversePurchase({
        tenantId,
        stripeSessionId: 'cs_1',
        reason: 'Refunded',
      });

      expect(result?.balance).toBe(-800);
    });

    it('does nothing when no purchase matches the session', async () => {
      prisma.creditLedgerEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.reversePurchase({
          tenantId,
          stripeSessionId: 'cs_missing',
          reason: 'Refunded',
        }),
      ).resolves.toBeNull();

      expect(tx.tenantCreditBalance.update).not.toHaveBeenCalled();
    });

    // A mismatch means our tenant mapping is wrong; deducting from the wrong
    // account would compound the error.
    it('refuses to deduct from a different tenant than bought it', async () => {
      prisma.creditLedgerEntry.findUnique.mockResolvedValue({
        ...purchase,
        tenantId: 'someone-else',
      });

      await expect(
        service.reversePurchase({
          tenantId,
          stripeSessionId: 'cs_1',
          reason: 'Refunded',
        }),
      ).resolves.toBeNull();

      expect(tx.tenantCreditBalance.update).not.toHaveBeenCalled();
    });

    it('will not reverse a row that is not a grant', async () => {
      prisma.creditLedgerEntry.findUnique.mockResolvedValue({
        ...purchase,
        amount: -20,
      });

      await expect(
        service.reversePurchase({
          tenantId,
          stripeSessionId: 'cs_1',
          reason: 'Refunded',
        }),
      ).resolves.toBeNull();
    });
  });
});
