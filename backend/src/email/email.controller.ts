import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @RequirePermission('proposals.update')
  sendEmail(@Req() req: Request, @Body('leadId') leadId: string) {
    const user = req.user as unknown as ActiveUser;
    return this.emailService.sendProposalEmail(user.tenantId, leadId);
  }

  @Post('send-bulk')
  @RequirePermission('proposals.update')
  sendBulkEmails(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.emailService.sendBulkProposalEmails(user.tenantId);
  }
}
