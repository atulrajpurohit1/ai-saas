import { Module } from '@nestjs/common';
import { GuardPortalController } from './guard-portal.controller';
import { GuardPortalService } from './guard-portal.service';

@Module({
  controllers: [GuardPortalController],
  providers: [GuardPortalService],
})
export class GuardPortalModule {}
