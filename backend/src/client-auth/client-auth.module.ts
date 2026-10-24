import { Module } from '@nestjs/common';
import { ClientAuthService } from './client-auth.service';
import { ClientAuthController } from './client-auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { EmailVerificationModule } from '../email-verification/email-verification.module';

@Module({
  // AuthModule is imported for AuthRateLimitService, shared with the admin
  // portal so one attacker cannot get a fresh allowance per portal.
  // EmailVerificationModule provides the OTP + reset-token machinery the
  // forgot-password flow reuses (same as the admin portal).
  imports: [
    PrismaModule,
    JwtModule.register({}),
    AuthModule,
    EmailVerificationModule,
  ],
  controllers: [ClientAuthController],
  providers: [ClientAuthService],
})
export class ClientAuthModule {}
