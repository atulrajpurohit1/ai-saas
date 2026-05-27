import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientInvoicesController } from './client-invoices.controller';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InvoicesController, ClientInvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
