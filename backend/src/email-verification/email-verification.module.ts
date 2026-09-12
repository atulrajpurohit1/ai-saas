import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { EmailValidationService } from './email-validation.service';
import { EmailVerificationService } from './email-verification.service';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [EmailValidationService, EmailVerificationService],
  exports: [EmailValidationService, EmailVerificationService],
})
export class EmailVerificationModule {}
