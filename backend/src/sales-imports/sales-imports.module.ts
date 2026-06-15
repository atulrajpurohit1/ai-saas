import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesImportsController } from './sales-imports.controller';
import { SalesImportsService } from './sales-imports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SalesImportsController],
  providers: [SalesImportsService],
})
export class SalesImportsModule {}
