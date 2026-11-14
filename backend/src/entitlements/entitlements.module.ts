import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PlanGuard } from '../auth/guards/plan.guard';
import { EntitlementsService } from './entitlements.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [EntitlementsService, ModuleGuard, PlanGuard],
  exports: [EntitlementsService, ModuleGuard, PlanGuard],
})
export class EntitlementsModule {}
