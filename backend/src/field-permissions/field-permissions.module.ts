import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';
import { FieldPermissionsController } from './field-permissions.controller';
import { FieldPermissionsService } from './field-permissions.service';

@Module({
  imports: [PrismaModule, AuditModule, RolesModule],
  controllers: [FieldPermissionsController],
  providers: [FieldPermissionsService],
  exports: [FieldPermissionsService],
})
export class FieldPermissionsModule {}
