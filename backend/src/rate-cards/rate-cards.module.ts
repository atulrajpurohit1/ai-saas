import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RateCardsController } from './rate-cards.controller';
import { RateCardsService } from './rate-cards.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RateCardsController],
  providers: [RateCardsService],
})
export class RateCardsModule {}
