import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesDeliveryController } from './sales-delivery.controller';
import { SalesDeliveryService } from './sales-delivery.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SalesDeliveryController],
  providers: [SalesDeliveryService],
})
export class SalesDeliveryModule {}
