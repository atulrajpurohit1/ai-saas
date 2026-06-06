import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { RolesService } from '../roles/roles.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('me')
  async getMe(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.rolesService.getUserAccessProfile(user.sub);
  }
}
