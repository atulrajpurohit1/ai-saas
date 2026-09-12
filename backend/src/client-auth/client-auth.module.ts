import { Module } from '@nestjs/common';
import { ClientAuthService } from './client-auth.service';
import { ClientAuthController } from './client-auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { EmailVerificationModule } from '../email-verification/email-verification.module';

@Module({
  imports: [PrismaModule, JwtModule.register({}), EmailVerificationModule],
  controllers: [ClientAuthController],
  providers: [ClientAuthService],
})
export class ClientAuthModule {}
