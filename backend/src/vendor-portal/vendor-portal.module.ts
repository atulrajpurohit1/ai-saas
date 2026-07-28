import { Module } from '@nestjs/common';
import { VendorPortalService } from './vendor-portal.service';
import { VendorPortalController } from './vendor-portal.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VendorPortalController],
  providers: [VendorPortalService],
})
export class VendorPortalModule {}
