import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { EmailVerificationModule } from '../email-verification/email-verification.module';
import { AccountSecurityController } from './account-security.controller';
import { AccountSecurityService } from './account-security.service';

@Module({
  imports: [PrismaModule, EmailModule, EmailVerificationModule],
  controllers: [AccountSecurityController],
  providers: [AccountSecurityService],
})
export class AccountSecurityModule {}
