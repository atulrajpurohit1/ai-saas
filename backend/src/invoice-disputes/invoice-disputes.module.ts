import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoiceDisputesController } from './invoice-disputes.controller';
import { InvoiceDisputesService } from './invoice-disputes.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InvoiceDisputesController],
  providers: [InvoiceDisputesService],
})
export class InvoiceDisputesModule {}
