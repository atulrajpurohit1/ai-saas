import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { GuardMeteringService } from './guard-metering.service';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { CreditReservationScheduler } from './credit-reservation.scheduler';
import { CreditBalanceAlertService } from './credit-balance-alert.service';
import { CreditBalanceAlertScheduler } from './credit-balance-alert.scheduler';
import { CreditAutoRechargeService } from './credit-auto-recharge.service';
import { CreditAutoRechargeScheduler } from './credit-auto-recharge.scheduler';
import { CreditAutoRechargeController } from './credit-auto-recharge.controller';
import { AiMeteringService } from './ai-metering.service';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [PrismaModule, AuditModule, EmailModule],
  controllers: [
    BillingController,
    CreditsController,
    CreditAutoRechargeController,
    StripeWebhookController,
  ],
  providers: [
    BillingService,
    StripeService,
    StripeWebhookService,
    SubscriptionProvisioningService,
    GuardMeteringService,
    CreditsService,
    CreditReservationScheduler,
    CreditBalanceAlertService,
    CreditBalanceAlertScheduler,
    CreditAutoRechargeService,
    CreditAutoRechargeScheduler,
    AiMeteringService,
  ],
  exports: [
    BillingService,
    SubscriptionProvisioningService,
    GuardMeteringService,
    CreditsService,
    // Injected by ProposalsService, LeadsService, RfpService,
    // SalesAcceleratorService and RecommendationService. @Global() exposes
    // this module everywhere, but only what is exported can be injected, so
    // leaving this out crashed the app at startup rather than at build time.
    AiMeteringService,
  ],
})
export class BillingModule {}
