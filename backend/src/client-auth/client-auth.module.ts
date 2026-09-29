import { Module } from '@nestjs/common';
import { ClientAuthService } from './client-auth.service';
import { ClientAuthController } from './client-auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { EmailVerificationModule } from '../email-verification/email-verification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule is imported for AuthRateLimitService, shared with the admin
  // portal so one attacker cannot get a fresh allowance per portal.
  imports: [
    PrismaModule,
    JwtModule.register({}),
    EmailVerificationModule,
    AuthModule,
  ],
  controllers: [ClientAuthController],
  providers: [ClientAuthService],
})
export class ClientAuthModule {}
