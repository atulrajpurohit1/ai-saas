import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { ServiceModule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BillingInterval,
  billingReturnUrls,
  isCheckoutConfigured,
  priceIdFor,
  stripeSecretKey,
  stripeWebhookSecret,
  trialDays,
} from './billing.config';

/**
 * Thin wrapper over the Stripe SDK.
 *
 * Constructed lazily: the app must boot and run normally with no Stripe keys
 * configured, which is the state it is in until the client provides them.
 * Every method that needs Stripe throws 503 with an explicit message rather
 * than failing obscurely at startup.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly prisma: PrismaService) {}

  get configured() {
    return isCheckoutConfigured();
  }

  private stripe(): Stripe {
    if (!this.client) {
      const key = stripeSecretKey();
      if (!key) {
        throw new ServiceUnavailableException(
          'Payments are not configured yet. Set STRIPE_SECRET_KEY to enable checkout.',
        );
      }
      this.client = new Stripe(key);
    }
    return this.client;
  }

  /**
   * Reuses the tenant's Stripe customer if we already have one, so a customer
   * adding a second service does not end up with two customer records and two
   * unrelated invoices.
   */
  private async customerIdFor(tenantId: string, email?: string) {
    const existing = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { providerCustomerId: true },
    });
    if (existing?.providerCustomerId) return existing.providerCustomerId;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const customer = await this.stripe().customers.create({
      name: tenant?.name ?? undefined,
      email,
      // tenantId on the customer means a Stripe-side lookup can always find
      // its way back to us, even if a webhook arrives without our metadata.
      metadata: { tenantId },
    });

    return customer.id;
  }

  async createCheckoutSession(params: {
    tenantId: string;
    modules: ServiceModule[];
    interval: BillingInterval;
    email?: string;
  }) {
    const { tenantId, modules, interval, email } = params;

    if (!modules.length) {
      throw new BadRequestException('Select at least one service to purchase.');
    }

    const lineItems = modules.map((module) => {
      const price = priceIdFor(module, interval);
      if (!price) {
        throw new ServiceUnavailableException(
          `No ${interval} price is configured for ${module} yet.`,
        );
      }
      return { price, quantity: 1 };
    });

    const urls = billingReturnUrls();
    const trial = trialDays();
    const customer = await this.customerIdFor(tenantId, email);

    const session = await this.stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: lineItems,
      success_url: urls.success,
      cancel_url: urls.cancel,
      // Carried through to the subscription so every later webhook -- renewal,
      // payment failure, cancellation -- can identify the tenant without a
      // customer lookup.
      metadata: { tenantId, modules: modules.join(',') },
      subscription_data: {
        metadata: { tenantId, modules: modules.join(',') },
        ...(trial ? { trial_period_days: trial } : {}),
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  /** Stripe-hosted page for cards, invoices, plan changes and cancellation. */
  async createPortalSession(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { providerCustomerId: true },
    });

    if (!subscription?.providerCustomerId) {
      throw new BadRequestException(
        'This account has no payment record yet. Purchase a service first.',
      );
    }

    const session = await this.stripe().billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: billingReturnUrls().portalReturn,
    });

    return { url: session.url };
  }

  /**
   * Verifies a webhook against the signing secret.
   *
   * Without this anyone who finds the endpoint could grant themselves every
   * service by POSTing a fake `checkout.session.completed`, so an unverifiable
   * payload is rejected outright rather than parsed.
   */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = stripeWebhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Webhooks are not configured. Set STRIPE_WEBHOOK_SECRET.',
      );
    }

    try {
      return this.stripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Rejected webhook with a bad signature: ${message}`);
      throw new BadRequestException('Invalid webhook signature.');
    }
  }

  /** The price ids actually on a subscription, for resolving modules. */
  async priceIdsForSubscription(subscriptionId: string): Promise<string[]> {
    const subscription =
      await this.stripe().subscriptions.retrieve(subscriptionId);
    return subscription.items.data
      .map((item) => item.price?.id)
      .filter((id): id is string => Boolean(id));
  }

  async retrieveSubscription(subscriptionId: string) {
    return this.stripe().subscriptions.retrieve(subscriptionId);
  }
}
