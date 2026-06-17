import { Module } from '@nestjs/common';
import { CallTranscriptionController } from './call-transcription.controller';
import { CallTranscriptionService } from './call-transcription.service';

@Module({
  controllers: [CallTranscriptionController],
  providers: [CallTranscriptionService],
})
export class CallTranscriptionModule {}
