import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SsoAuthController } from './sso-auth.controller';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';

@Module({
  imports: [PrismaModule, AuditModule, RolesModule, AuthModule, SessionsModule, ConfigModule],
  controllers: [SsoController, SsoAuthController],
  providers: [SsoService],
})
export class SsoModule {}
