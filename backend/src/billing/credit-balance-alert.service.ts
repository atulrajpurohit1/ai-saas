import { Injectable, Logger } from '@nestjs/common';
import { CreditAlertTier, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { fullDiscoveryCreditCost } from './credit-packs.constants';

/**
 * Default LOW threshold, in credits. A full discovery costs 200 by default, so
 * 500 means "fewer than three searches left" -- late enough not to nag a
 * healthy account, early enough to buy credits before work stops.
 */
const DEFAULT_LOW_THRESHOLD = 500;

export interface CreditAlertOutcome {
  tenantsChecked: number;
  alertsSent: number;
  alertsCleared: number;
  failures: number;
}

/**
 * Emails tenants when their Prospect Search credits run low or run out.
 *
 * Credits are already enforced -- reserve() refuses a search that cannot be
 * paid for. What was missing is any warning before that happens: a tenant
 * discovered they were out of credits by having a search rejected, which is
 * the worst possible moment to find out.
 *
 * Alerts are recorded so a tenant is notified once per drain cycle rather than
 * once per sweep, and cleared when the balance recovers so the next drain
 * notifies again.
 */
@Injectable()
export class CreditBalanceAlertService {
  private readonly logger = new Logger(CreditBalanceAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The LOW threshold in credits. Configurable because what counts as "low"
   * depends on how much a tenant searches; falls back to a multiple of the
   * per-search cost so the default stays sane if search pricing changes.
   */
  lowThreshold(): number {
    const configured = Number(
      this.config.get<string>('CREDIT_LOW_BALANCE_THRESHOLD'),
    );
    if (Number.isFinite(configured) && configured > 0) return configured;

    const perSearch = fullDiscoveryCreditCost();
    return perSearch > 0
      ? Math.max(DEFAULT_LOW_THRESHOLD, perSearch * 2)
      : DEFAULT_LOW_THRESHOLD;
  }

  private purchaseUrl(): string {
    const base =
      this.config.get<string>('FRONTEND_URL')?.trim().replace(/\/+$/, '') ?? '';
    return base ? `${base}/billing/credits` : 'your AegisLead billing page';
  }

  /**
   * Billing contacts for a tenant. ADMIN and FINANCE only -- the recipient
   * has to be someone who can actually buy credits. Unverified addresses are
   * excluded because signup blocks login until verification, so an unverified
   * address is one nobody has proven they can read.
   */
  private async billingRecipients(tenantId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: [UserRole.ADMIN, UserRole.FINANCE] },
        emailVerified: true,
      },
      select: { email: true },
    });

    return users
      .map((u) => u.email?.trim())
      .filter((email): email is string => !!email);
  }

  /**
   * Checks every tenant's balance and sends any alert that is newly due.
   *
   * Never throws: one tenant's failure (no billing contact, SMTP refusal)
   * must not stop the rest from being warned, so failures are counted and
   * logged rather than propagated.
   */
  async sweep(): Promise<CreditAlertOutcome> {
    const threshold = this.lowThreshold();
    const outcome: CreditAlertOutcome = {
      tenantsChecked: 0,
      alertsSent: 0,
      alertsCleared: 0,
      failures: 0,
    };

    // Only tenants who have ever held credits are candidates: a tenant that
    // never bought any is not "running low", they simply do not use the
    // feature, and emailing them would be spam.
    const balances = await this.prisma.tenantCreditBalance.findMany({
      where: { lifetimePurchased: { gt: 0 } },
      select: { tenantId: true, balance: true },
    });

    for (const { tenantId, balance } of balances) {
      outcome.tenantsChecked += 1;
      try {
        const cleared = await this.clearRecoveredAlerts(tenantId, balance, threshold);
        outcome.alertsCleared += cleared;

        const tier = this.tierFor(balance, threshold);
        if (tier && (await this.sendIfNotAlreadyOpen(tenantId, tier, balance, threshold))) {
          outcome.alertsSent += 1;
        }
      } catch (error) {
        outcome.failures += 1;
        this.logger.error(
          `Credit balance alert failed for tenant ${tenantId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return outcome;
  }

  /** Which tier a balance falls into, or null when it is healthy. */
  private tierFor(balance: number, threshold: number): CreditAlertTier | null {
    if (balance <= 0) return CreditAlertTier.DEPLETED;
    if (balance <= threshold) return CreditAlertTier.LOW;
    return null;
  }

  /**
   * Clears open alerts a tenant has climbed back out of, re-arming them.
   *
   * DEPLETED clears as soon as there is any balance; LOW only once the balance
   * is back above the threshold. Without this, a tenant who drains, tops up
   * and drains again would never get a second warning.
   */
  private async clearRecoveredAlerts(
    tenantId: string,
    balance: number,
    threshold: number,
  ): Promise<number> {
    const recovered: CreditAlertTier[] = [];
    if (balance > 0) recovered.push(CreditAlertTier.DEPLETED);
    if (balance > threshold) recovered.push(CreditAlertTier.LOW);
    if (recovered.length === 0) return 0;

    const result = await this.prisma.creditBalanceAlert.updateMany({
      where: { tenantId, tier: { in: recovered }, clearedAt: null },
      data: { clearedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Sends one alert, unless that tier is already open for this tenant.
   *
   * The alert row is written BEFORE the email is sent. If the send then fails
   * the tenant is not re-notified on the next tick, which is the deliberate
   * trade: a missed warning is recoverable, whereas an SMTP error that retries
   * hourly becomes a mail loop. The failure is logged loudly instead.
   */
  private async sendIfNotAlreadyOpen(
    tenantId: string,
    tier: CreditAlertTier,
    balance: number,
    threshold: number,
  ): Promise<boolean> {
    const existing = await this.prisma.creditBalanceAlert.findFirst({
      where: { tenantId, tier, clearedAt: null },
      select: { id: true },
    });
    if (existing) return false;

    const recipients = await this.billingRecipients(tenantId);
    if (recipients.length === 0) {
      this.logger.warn(
        `Tenant ${tenantId} is at ${tier} credit balance (${balance}) but has no active ADMIN or FINANCE contact to notify.`,
      );
      return false;
    }

    // The unique index on (tenant_id, tier) WHERE cleared_at IS NULL is what
    // actually prevents a double send when two sweeps overlap; the findFirst
    // above is only the cheap path.
    await this.prisma.creditBalanceAlert.create({
      data: { tenantId, tier, balanceAtAlert: balance },
    });

    await this.email.sendCreditBalanceAlertEmail(tenantId, {
      recipients,
      tier,
      balance,
      threshold,
      purchaseUrl: this.purchaseUrl(),
    });

    this.logger.log(
      `Sent ${tier} credit balance alert to ${recipients.length} contact(s) for tenant ${tenantId} (balance ${balance}).`,
    );
    return true;
  }
}
