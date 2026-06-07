import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';

@Global()
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BrandingController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
