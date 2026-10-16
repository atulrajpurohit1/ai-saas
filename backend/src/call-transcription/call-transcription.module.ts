import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CallTranscriptionController } from './call-transcription.controller';
import { CallTranscriptionService } from './call-transcription.service';

@Module({
  imports: [BillingModule],
  controllers: [CallTranscriptionController],
  providers: [CallTranscriptionService],
})
export class CallTranscriptionModule {}
