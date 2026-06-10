import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BrandingService } from './branding.service';

@Global()
@Module({
  imports: [PrismaModule, AuditModule],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
