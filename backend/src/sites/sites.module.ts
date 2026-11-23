import { Module } from '@nestjs/common';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [PrismaModule, AuditModule, ShiftsModule],
  controllers: [SitesController],
  providers: [SitesService],
})
export class SitesModule {}
