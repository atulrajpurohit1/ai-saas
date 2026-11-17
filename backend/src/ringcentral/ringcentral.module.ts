import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RingCentralClientService } from './ringcentral-client.service';
import { RingCentralConnectionService } from './ringcentral-connection.service';
import { RingCentralSubscriptionService } from './ringcentral-subscription.service';
import { RingCentralSyncService } from './ringcentral-sync.service';
import { RingCentralRecordingService } from './ringcentral-recording.service';
import { RingCentralDialService } from './ringcentral-dial.service';
import { RingCentralController } from './ringcentral.controller';
import { RingCentralWebhookController } from './ringcentral-webhook.controller';
import { RingCentralScheduler } from './ringcentral.scheduler';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RingCentralController, RingCentralWebhookController],
  providers: [
    RingCentralClientService,
    RingCentralConnectionService,
    RingCentralSubscriptionService,
    RingCentralSyncService,
    RingCentralRecordingService,
    RingCentralDialService,
    RingCentralScheduler,
  ],
  exports: [RingCentralConnectionService, RingCentralClientService],
})
export class RingCentralModule {}
