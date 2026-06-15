import { Module } from '@nestjs/common';
import { GuardsService } from './guards.service';
import { GuardsAliasController, GuardsController } from './guards.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FieldPermissionsModule } from '../field-permissions/field-permissions.module';

@Module({
  imports: [PrismaModule, AuditModule, FieldPermissionsModule],
  controllers: [GuardsController, GuardsAliasController],
  providers: [GuardsService],
})
export class GuardsModule {}
