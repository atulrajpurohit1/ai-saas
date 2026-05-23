import { Body, Controller, Post } from '@nestjs/common';
import { GuardLoginDto } from './dto/guard-login.dto';
import { GuardAuthService } from './guard-auth.service';

@Controller('guard-auth')
export class GuardAuthController {
  constructor(private readonly guardAuthService: GuardAuthService) {}

  @Post('login')
  login(@Body() dto: GuardLoginDto) {
    return this.guardAuthService.login(dto);
  }
}
