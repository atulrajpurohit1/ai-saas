import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';

@Global()
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [
    BillingService,
    StripeService,
    StripeWebhookService,
    SubscriptionProvisioningService,
  ],
  exports: [BillingService, SubscriptionProvisioningService],
})
export class BillingModule {}
