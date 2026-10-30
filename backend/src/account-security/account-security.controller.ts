import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AccountSecurityService } from './account-security.service';
import { ConfirmPasswordDto } from './dto/confirm-password.dto';
import { StartRecoveryEmailDto } from './dto/start-recovery-email.dto';
import { SecurityCodeDto } from './dto/security-code.dto';

@UseGuards(JwtAuthGuard)
@Controller('account/security')
export class AccountSecurityController {
  constructor(private readonly service: AccountSecurityService) {}

  private userId(req: Request): string {
    return (req.user as unknown as ActiveUser).sub;
  }

  @Get()
  getStatus(@Req() req: Request) {
    return this.service.getStatus(this.userId(req));
  }

  @Post('recovery-email/start')
  @HttpCode(HttpStatus.OK)
  startRecoveryEmail(@Body() dto: StartRecoveryEmailDto, @Req() req: Request) {
    return this.service.startRecoveryEmail(this.userId(req), dto);
  }

  @Post('recovery-email/verify')
  @HttpCode(HttpStatus.OK)
  verifyRecoveryEmail(@Body() dto: SecurityCodeDto, @Req() req: Request) {
    return this.service.verifyRecoveryEmail(this.userId(req), dto);
  }

  @Delete('recovery-email')
  @HttpCode(HttpStatus.OK)
  removeRecoveryEmail(@Body() dto: ConfirmPasswordDto, @Req() req: Request) {
    return this.service.removeRecoveryEmail(this.userId(req), dto);
  }

  @Post('two-factor/enable/start')
  @HttpCode(HttpStatus.OK)
  startEnableTwoFactor(@Body() dto: ConfirmPasswordDto, @Req() req: Request) {
    return this.service.startEnableTwoFactor(this.userId(req), dto);
  }

  @Post('two-factor/enable/verify')
  @HttpCode(HttpStatus.OK)
  verifyEnableTwoFactor(@Body() dto: SecurityCodeDto, @Req() req: Request) {
    return this.service.verifyEnableTwoFactor(this.userId(req), dto);
  }

  @Post('two-factor/disable')
  @HttpCode(HttpStatus.OK)
  disableTwoFactor(@Body() dto: ConfirmPasswordDto, @Req() req: Request) {
    return this.service.disableTwoFactor(this.userId(req), dto);
  }
}
