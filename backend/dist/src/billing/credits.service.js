"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CreditsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const insufficient_credits_exception_1 = require("./insufficient-credits.exception");
const UNIQUE_VIOLATION = 'P2002';
let CreditsService = CreditsService_1 = class CreditsService {
    prisma;
    logger = new common_1.Logger(CreditsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBalance(tenantId) {
        const [row, pending] = await Promise.all([
            this.prisma.tenantCreditBalance.findUnique({ where: { tenantId } }),
            this.prisma.creditLedgerEntry.aggregate({
                where: {
                    tenantId,
                    type: client_1.CreditEntryType.RESERVATION,
                    reservationStatus: client_1.CreditReservationStatus.PENDING,
                },
                _sum: { amount: true },
            }),
        ]);
        return {
            balance: row?.balance ?? 0,
            lifetimePurchased: row?.lifetimePurchased ?? 0,
            lifetimeConsumed: row?.lifetimeConsumed ?? 0,
            reservedPending: Math.abs(pending._sum.amount ?? 0),
        };
    }
    async hasCredits(tenantId, required) {
        const { balance } = await this.getBalance(tenantId);
        return balance >= required;
    }
    async reserve(params) {
        const { tenantId, jobId, amount, description, userId } = params;
        if (!Number.isInteger(amount) || amount <= 0) {
            throw new common_1.BadRequestException('Credit reservation amount must be a positive whole number.');
        }
        try {
            return await this.prisma.$transaction(async (tx) => {
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
                    throw new insufficient_credits_exception_1.InsufficientCreditsException(`This search needs ${amount} Prospect Search credit${amount === 1 ? '' : 's'}, but your account has ${available}. Purchase more credits to continue.`, amount, available);
                }
                const balance = await tx.tenantCreditBalance.findUniqueOrThrow({
                    where: { tenantId },
                    select: { balance: true },
                });
                const entry = await tx.creditLedgerEntry.create({
                    data: {
                        tenantId,
                        type: client_1.CreditEntryType.RESERVATION,
                        amount: -amount,
                        balanceAfter: balance.balance,
                        description,
                        userId: userId ?? null,
                        jobId,
                        reservationStatus: client_1.CreditReservationStatus.PENDING,
                    },
                });
                return {
                    reservationId: entry.id,
                    reserved: amount,
                    balanceAfter: balance.balance,
                };
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === UNIQUE_VIOLATION) {
                const existing = await this.prisma.creditLedgerEntry.findFirst({
                    where: { tenantId, jobId, type: client_1.CreditEntryType.RESERVATION },
                });
                if (existing) {
                    this.logger.log(`Credit reservation for job ${jobId} already exists; reusing it rather than holding twice.`);
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
    async settle(params) {
        const { reservationId, actualUsed, description, upstreamCostUsd } = params;
        if (!Number.isInteger(actualUsed) || actualUsed < 0) {
            throw new common_1.BadRequestException('Settled credit amount must be zero or a positive whole number.');
        }
        return this.prisma.$transaction(async (tx) => {
            const reservation = await tx.creditLedgerEntry.findUnique({
                where: { id: reservationId },
            });
            if (!reservation || reservation.type !== client_1.CreditEntryType.RESERVATION) {
                this.logger.warn(`settle() called for ${reservationId}, which is not a reservation; ignoring.`);
                return null;
            }
            if (reservation.reservationStatus !== client_1.CreditReservationStatus.PENDING) {
                this.logger.debug(`Reservation ${reservationId} is already ${reservation.reservationStatus}; nothing to settle.`);
                return null;
            }
            const held = Math.abs(reservation.amount);
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
                        type: client_1.CreditEntryType.RELEASE,
                        amount: released,
                        balanceAfter: balance.balance,
                        description: description ??
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
                await tx.creditLedgerEntry.create({
                    data: {
                        tenantId: reservation.tenantId,
                        type: client_1.CreditEntryType.CONSUMPTION,
                        amount: 0,
                        balanceAfter: balance.balance,
                        description: description ??
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
                    reservationStatus: consumed > 0
                        ? client_1.CreditReservationStatus.SETTLED
                        : client_1.CreditReservationStatus.RELEASED,
                    settledAmount: consumed,
                    settledAt: new Date(),
                    ...(typeof upstreamCostUsd === 'number' &&
                        Number.isFinite(upstreamCostUsd)
                        ? { upstreamCostUsd }
                        : {}),
                },
            });
            return { released, consumed };
        });
    }
    async findReservation(tenantId, jobId) {
        return this.prisma.creditLedgerEntry.findFirst({
            where: { tenantId, jobId, type: client_1.CreditEntryType.RESERVATION },
        });
    }
    async releaseFully(reservationId, description) {
        return this.settle({ reservationId, actualUsed: 0, description });
    }
    async grant(params) {
        const { tenantId, amount, description, stripeSessionId, userId, type = client_1.CreditEntryType.PURCHASE, } = params;
        if (!Number.isInteger(amount) || amount === 0) {
            throw new common_1.BadRequestException('Credit grant amount must be a non-zero whole number.');
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
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === UNIQUE_VIOLATION &&
                stripeSessionId) {
                this.logger.log(`Credits for Stripe session ${stripeSessionId} were already granted; ignoring the replay.`);
                const current = await this.prisma.tenantCreditBalance.findUnique({
                    where: { tenantId },
                    select: { balance: true },
                });
                return { balance: current?.balance ?? 0, granted: false };
            }
            throw error;
        }
    }
    async reversePurchase(params) {
        const { tenantId, stripeSessionId, reason } = params;
        const purchase = await this.prisma.creditLedgerEntry.findUnique({
            where: { stripeSessionId },
        });
        if (!purchase || purchase.amount <= 0) {
            this.logger.warn(`No credit purchase found for Stripe session ${stripeSessionId}; nothing to reverse.`);
            return null;
        }
        if (purchase.tenantId !== tenantId) {
            this.logger.error(`Refund for session ${stripeSessionId} names tenant ${tenantId}, but the purchase belongs to ${purchase.tenantId}; refusing to reverse.`);
            return null;
        }
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const balance = await tx.tenantCreditBalance.update({
                    where: { tenantId },
                    data: {
                        balance: { decrement: purchase.amount },
                        lifetimePurchased: { decrement: purchase.amount },
                    },
                    select: { balance: true },
                });
                await tx.creditLedgerEntry.create({
                    data: {
                        tenantId,
                        type: client_1.CreditEntryType.ADJUSTMENT,
                        amount: -purchase.amount,
                        balanceAfter: balance.balance,
                        description: reason,
                        stripeSessionId: `refund:${stripeSessionId}`,
                    },
                });
                return { reversed: purchase.amount, balance: balance.balance };
            });
            this.logger.log(`Reversed ${result.reversed} credits for tenant ${tenantId} after a refund of ${stripeSessionId}; balance is now ${result.balance}.`);
            return result;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === UNIQUE_VIOLATION) {
                this.logger.log(`Refund for session ${stripeSessionId} was already reversed; ignoring the replay.`);
                return null;
            }
            throw error;
        }
    }
    async getLedger(tenantId, limit = 50) {
        return this.prisma.creditLedgerEntry.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: Math.min(Math.max(limit, 1), 200),
        });
    }
    async expireStaleReservations(olderThanMinutes = 60) {
        const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
        const stale = await this.prisma.creditLedgerEntry.findMany({
            where: {
                type: client_1.CreditEntryType.RESERVATION,
                reservationStatus: client_1.CreditReservationStatus.PENDING,
                createdAt: { lt: cutoff },
            },
            select: { id: true },
        });
        let released = 0;
        for (const entry of stale) {
            const result = await this.releaseFully(entry.id, 'Search did not complete in time; credits returned automatically.');
            if (result)
                released += result.released;
        }
        if (released > 0) {
            this.logger.log(`Expired ${stale.length} stale credit reservation(s), returning ${released} credit(s).`);
        }
        return { expired: stale.length, released };
    }
};
exports.CreditsService = CreditsService;
exports.CreditsService = CreditsService = CreditsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CreditsService);
//# sourceMappingURL=credits.service.js.map