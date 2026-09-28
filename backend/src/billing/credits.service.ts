import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  CreditEntryType,
  CreditReservationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientCreditsException } from './insufficient-credits.exception';

export interface CreditReservation {
  reservationId: string;
  reserved: number;
  balanceAfter: number;
}

export interface CreditBalanceSummary {
  balance: number;
  lifetimePurchased: number;
  lifetimeConsumed: number;
  /** Credits currently held by jobs that have not settled yet. */
  reservedPending: number;
}

/** Unique-constraint violation. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * Prospect Search credit ledger.
 *
 * BlackPearl jobs are asynchronous and bill per prospect, so we cannot know the
 * true cost when the user clicks Search -- the count only arrives minutes later
 * when the job succeeds. The flow is therefore reserve-then-settle:
 *
 *   1. reserve()  holds the maximum the job could cost, before submitting it.
 *   2. settle()   records what was actually used and hands back the remainder.
 *
 * Holding up front is what stops a tenant with one credit firing fifty
 * concurrent jobs and leaving us with the BlackPearl bill. Every mutation runs
 * inside a transaction that writes both the ledger row and the balance, so the
 * balance can never disagree with the sum of the ledger.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBalance(tenantId: string): Promise<CreditBalanceSummary> {
    const [row, pending] = await Promise.all([
      this.prisma.tenantCreditBalance.findUnique({ where: { tenantId } }),
      this.prisma.creditLedgerEntry.aggregate({
        where: {
          tenantId,
          type: CreditEntryType.RESERVATION,
          reservationStatus: CreditReservationStatus.PENDING,
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      balance: row?.balance ?? 0,
      lifetimePurchased: row?.lifetimePurchased ?? 0,
      lifetimeConsumed: row?.lifetimeConsumed ?? 0,
      // Reservation amounts are stored negative; report the magnitude.
      reservedPending: Math.abs(pending._sum.amount ?? 0),
    };
  }

  async hasCredits(tenantId: string, required: number): Promise<boolean> {
    const { balance } = await this.getBalance(tenantId);
    return balance >= required;
  }

  /**
   * Holds `amount` credits against a BlackPearl job.
   *
   * Throws 402 when the tenant cannot afford it -- deliberately a distinct
   * status from the 403 an entitlement failure raises, so the frontend can tell
   * "you do not have this feature" apart from "you have run out of credits".
   *
   * Idempotent per (tenant, job): the unique index on
   * (tenant_id, job_id, type) means a retried submit for the same job id
   * returns the existing hold rather than taking the credits twice.
   */
  async reserve(params: {
    tenantId: string;
    jobId: string;
    amount: number;
    description: string;
    userId?: string;
  }): Promise<CreditReservation> {
    const { tenantId, jobId, amount, description, userId } = params;

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        'Credit reservation amount must be a positive whole number.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Conditional update is the concurrency guard: two simultaneous
        // reservations cannot both pass, because the second one's
        // `balance: { gte: amount }` no longer holds once the first commits.
        const updated = await tx.tenantCreditBalance.updateMany({
          where: { tenantId, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });

        if (updated.count === 0) {
          const current = await tx.tenantCreditBalance.findUnique({
            where: { tenantId },
            select: { balance: true },
          });
          const available = current?.balance ?? 0;
          throw new InsufficientCreditsException(
            `This search needs ${amount} Prospect Search credit${
              amount === 1 ? '' : 's'
            }, but your account has ${available}. Purchase more credits to continue.`,
            amount,
            available,
          );
        }

        const balance = await tx.tenantCreditBalance.findUniqueOrThrow({
          where: { tenantId },
          select: { balance: true },
        });

        const entry = await tx.creditLedgerEntry.create({
          data: {
            tenantId,
            type: CreditEntryType.RESERVATION,
            amount: -amount,
            balanceAfter: balance.balance,
            description,
            userId: userId ?? null,
            jobId,
            reservationStatus: CreditReservationStatus.PENDING,
          },
        });

        return {
          reservationId: entry.id,
          reserved: amount,
          balanceAfter: balance.balance,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        const existing = await this.prisma.creditLedgerEntry.findFirst({
          where: { tenantId, jobId, type: CreditEntryType.RESERVATION },
        });
        if (existing) {
          this.logger.log(
            `Credit reservation for job ${jobId} already exists; reusing it rather than holding twice.`,
          );
          return {
            reservationId: existing.id,
            reserved: Math.abs(existing.amount),
            balanceAfter: existing.balanceAfter,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Closes out a reservation once the job reaches a terminal state.
   *
   * `actualUsed` is what the job really cost (0 for a failed job, which
   * therefore refunds in full). Anything held above that is returned to the
   * balance as a RELEASE row. Idempotent: a reservation that is no longer
   * PENDING is left exactly as it is, so a double poll cannot refund twice.
   */
  async settle(params: {
    reservationId: string;
    actualUsed: number;
    description?: string;
  }): Promise<{ released: number; consumed: number } | null> {
    const { reservationId, actualUsed, description } = params;

    if (!Number.isInteger(actualUsed) || actualUsed < 0) {
      throw new BadRequestException(
        'Settled credit amount must be zero or a positive whole number.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.creditLedgerEntry.findUnique({
        where: { id: reservationId },
      });

      if (!reservation || reservation.type !== CreditEntryType.RESERVATION) {
        this.logger.warn(
          `settle() called for ${reservationId}, which is not a reservation; ignoring.`,
        );
        return null;
      }

      if (reservation.reservationStatus !== CreditReservationStatus.PENDING) {
        this.logger.debug(
          `Reservation ${reservationId} is already ${reservation.reservationStatus}; nothing to settle.`,
        );
        return null;
      }

      const held = Math.abs(reservation.amount);
      // A job cannot consume more than was held for it -- if BlackPearl
      // returned more prospects than the limit we reserved against, we absorb
      // the difference rather than silently overcharging the customer.
      const consumed = Math.min(actualUsed, held);
      const released = held - consumed;

      if (released > 0) {
        const balance = await tx.tenantCreditBalance.update({
          where: { tenantId: reservation.tenantId },
          data: { balance: { increment: released } },
          select: { balance: true },
        });

        await tx.creditLedgerEntry.create({
          data: {
            tenantId: reservation.tenantId,
            type: CreditEntryType.RELEASE,
            amount: released,
            balanceAfter: balance.balance,
            description:
              description ??
              `Returned ${released} unused credit${released === 1 ? '' : 's'}.`,
            userId: reservation.userId,
            jobId: reservation.jobId,
            reservationId: reservation.id,
          },
        });
      }

      if (consumed > 0) {
        const balance = await tx.tenantCreditBalance.update({
          where: { tenantId: reservation.tenantId },
          data: { lifetimeConsumed: { increment: consumed } },
          select: { balance: true },
        });

        // Zero-amount row: the credits already left the balance when they were
        // reserved. This exists so the ledger records the terminal outcome
        // explicitly instead of leaving it to be inferred.
        await tx.creditLedgerEntry.create({
          data: {
            tenantId: reservation.tenantId,
            type: CreditEntryType.CONSUMPTION,
            amount: 0,
            balanceAfter: balance.balance,
            description:
              description ??
              `Used ${consumed} credit${consumed === 1 ? '' : 's'}.`,
            userId: reservation.userId,
            jobId: reservation.jobId,
            reservationId: reservation.id,
          },
        });
      }

      await tx.creditLedgerEntry.update({
        where: { id: reservation.id },
        data: {
          reservationStatus:
            consumed > 0
              ? CreditReservationStatus.SETTLED
              : CreditReservationStatus.RELEASED,
          settledAmount: consumed,
          settledAt: new Date(),
        },
      });

      return { released, consumed };
    });
  }

  /**
   * The reservation held against a job, if there is one. Scoped by tenant so a
   * job id from one tenant can never settle another tenant's hold.
   */
  async findReservation(tenantId: string, jobId: string) {
    return this.prisma.creditLedgerEntry.findFirst({
      where: { tenantId, jobId, type: CreditEntryType.RESERVATION },
    });
  }

  /** Releases a hold in full. Used when submission itself fails. */
  async releaseFully(reservationId: string, description?: string) {
    return this.settle({ reservationId, actualUsed: 0, description });
  }

  /**
   * Adds credits. Called by the Stripe webhook on a completed pack purchase,
   * and by platform admins granting credits by hand.
   *
   * `stripeSessionId` carries the unique constraint that makes this safe
   * against Stripe's at-least-once delivery: a replayed webhook hits the index
   * and is dropped rather than granting the pack a second time.
   */
  async grant(params: {
    tenantId: string;
    amount: number;
    description: string;
    stripeSessionId?: string;
    userId?: string;
    type?: CreditEntryType;
  }): Promise<{ balance: number; granted: boolean }> {
    const {
      tenantId,
      amount,
      description,
      stripeSessionId,
      userId,
      type = CreditEntryType.PURCHASE,
    } = params;

    if (!Number.isInteger(amount) || amount === 0) {
      throw new BadRequestException(
        'Credit grant amount must be a non-zero whole number.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const balance = await tx.tenantCreditBalance.upsert({
          where: { tenantId },
          create: {
            tenantId,
            balance: amount,
            lifetimePurchased: amount > 0 ? amount : 0,
          },
          update: {
            balance: { increment: amount },
            ...(amount > 0 ? { lifetimePurchased: { increment: amount } } : {}),
          },
          select: { balance: true },
        });

        await tx.creditLedgerEntry.create({
          data: {
            tenantId,
            type,
            amount,
            balanceAfter: balance.balance,
            description,
            userId: userId ?? null,
            stripeSessionId: stripeSessionId ?? null,
          },
        });

        return { balance: balance.balance, granted: true };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION &&
        stripeSessionId
      ) {
        this.logger.log(
          `Credits for Stripe session ${stripeSessionId} were already granted; ignoring the replay.`,
        );
        const current = await this.prisma.tenantCreditBalance.findUnique({
          where: { tenantId },
          select: { balance: true },
        });
        return { balance: current?.balance ?? 0, granted: false };
      }
      throw error;
    }
  }

  /**
   * Reverses a credit purchase that was refunded or charged back.
   *
   * Deducts what was originally granted for that Stripe session. The balance is
   * allowed to go NEGATIVE here, deliberately: the customer may already have
   * spent the credits, and refusing to claw back what is left would leave them
   * with free usage. A negative balance simply blocks further searches until
   * they buy again, which is the correct outcome for a refunded purchase.
   *
   * Idempotent per session: the reversal is written with its own unique
   * `stripeSessionId`, so a redelivered refund event cannot deduct twice.
   */
  async reversePurchase(params: {
    tenantId: string;
    stripeSessionId: string;
    reason: string;
  }): Promise<{ reversed: number; balance: number } | null> {
    const { tenantId, stripeSessionId, reason } = params;

    const purchase = await this.prisma.creditLedgerEntry.findUnique({
      where: { stripeSessionId },
    });

    if (!purchase || purchase.amount <= 0) {
      this.logger.warn(
        `No credit purchase found for Stripe session ${stripeSessionId}; nothing to reverse.`,
      );
      return null;
    }

    if (purchase.tenantId !== tenantId) {
      // Refusing rather than reversing: a mismatch means our tenant mapping is
      // wrong somewhere, and deducting from the wrong account would compound it.
      this.logger.error(
        `Refund for session ${stripeSessionId} names tenant ${tenantId}, but the purchase belongs to ${purchase.tenantId}; refusing to reverse.`,
      );
      return null;
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const balance = await tx.tenantCreditBalance.update({
          where: { tenantId },
          data: {
            balance: { decrement: purchase.amount },
            // Undo the lifetime purchase figure too, so the billing screen does
            // not keep crediting them for a purchase that was given back.
            lifetimePurchased: { decrement: purchase.amount },
          },
          select: { balance: true },
        });

        await tx.creditLedgerEntry.create({
          data: {
            tenantId,
            type: CreditEntryType.ADJUSTMENT,
            amount: -purchase.amount,
            balanceAfter: balance.balance,
            description: reason,
            // Namespaced so it cannot collide with the purchase row it reverses
            // while still being unique, which is what makes this idempotent.
            stripeSessionId: `refund:${stripeSessionId}`,
          },
        });

        return { reversed: purchase.amount, balance: balance.balance };
      });

      this.logger.log(
        `Reversed ${result.reversed} credits for tenant ${tenantId} after a refund of ${stripeSessionId}; balance is now ${result.balance}.`,
      );

      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        this.logger.log(
          `Refund for session ${stripeSessionId} was already reversed; ignoring the replay.`,
        );
        return null;
      }
      throw error;
    }
  }

  /** Ledger rows for the billing screen, newest first. */
  async getLedger(tenantId: string, limit = 50) {
    return this.prisma.creditLedgerEntry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Releases holds for jobs that never reached a terminal state.
   *
   * Without this, a job abandoned mid-flight -- the user closed the tab, the
   * backend restarted, BlackPearl never finished -- would hold its credits
   * forever. Intended to be run on a schedule; the age cutoff is deliberately
   * well past BlackPearl's observed worst case of ~15 minutes.
   */
  async expireStaleReservations(olderThanMinutes = 60) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);

    const stale = await this.prisma.creditLedgerEntry.findMany({
      where: {
        type: CreditEntryType.RESERVATION,
        reservationStatus: CreditReservationStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });

    let released = 0;
    for (const entry of stale) {
      const result = await this.releaseFully(
        entry.id,
        'Search did not complete in time; credits returned automatically.',
      );
      if (result) released += result.released;
    }

    if (released > 0) {
      this.logger.log(
        `Expired ${stale.length} stale credit reservation(s), returning ${released} credit(s).`,
      );
    }

    return { expired: stale.length, released };
  }
}
