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
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [PrismaModule, AuditModule, EmailModule],
  controllers: [BillingController, CreditsController, StripeWebhookController],
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
  ],
  exports: [
    BillingService,
    SubscriptionProvisioningService,
    GuardMeteringService,
    CreditsService,
  ],
})
export class BillingModule {}
