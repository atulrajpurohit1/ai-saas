import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { GuardAuthController } from './guard-auth.controller';
import { GuardAuthService } from './guard-auth.service';

@Module({
  imports: [AuditModule, JwtModule.register({})],
  controllers: [GuardAuthController],
  providers: [GuardAuthService],
})
export class GuardAuthModule {}
