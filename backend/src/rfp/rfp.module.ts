import { Module } from '@nestjs/common';
import { RfpService } from './rfp.service';
import { RfpController } from './rfp.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, AiModule, EmailModule],
  controllers: [RfpController],
  providers: [RfpService],
  exports: [RfpService],
})
export class RfpModule {}
