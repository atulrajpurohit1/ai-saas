import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { GuardAuthController } from './guard-auth.controller';
import { GuardAuthService } from './guard-auth.service';

@Module({
  // AuthModule is imported so the shared 'jwt-refresh' passport strategy
  // (used by guard-auth/refresh + guard-auth/logout) is registered.
  imports: [AuditModule, AuthModule, JwtModule.register({})],
  controllers: [GuardAuthController],
  providers: [GuardAuthService],
})
export class GuardAuthModule {}
