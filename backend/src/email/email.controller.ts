import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Roles('admin')
  @Post('send')
  sendEmail(@Req() req: Request, @Body('leadId') leadId: string) {
    const user = req.user as unknown as ActiveUser;
    return this.emailService.sendProposalEmail(user.tenantId, leadId);
  }

  @Roles('admin')
  @Post('send-bulk')
  sendBulkEmails(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.emailService.sendBulkProposalEmails(user.tenantId);
  }
}
