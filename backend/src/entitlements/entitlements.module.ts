import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ModuleGuard } from '../auth/guards/module.guard';
import { EntitlementsService } from './entitlements.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [EntitlementsService, ModuleGuard],
  exports: [EntitlementsService, ModuleGuard],
})
export class EntitlementsModule {}
