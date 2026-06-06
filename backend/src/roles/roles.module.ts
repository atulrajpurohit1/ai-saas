import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Global()
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RolesController],
  providers: [RolesService, PermissionGuard],
  exports: [RolesService, PermissionGuard],
})
export class RolesModule {}
