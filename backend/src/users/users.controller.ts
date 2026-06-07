import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { RolesService } from '../roles/roles.service';
import { BrandingService } from '../branding/branding.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly brandingService: BrandingService,
  ) {}

  @Get('me')
  async getMe(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    const profile = await this.rolesService.getUserAccessProfile(user.sub);
    return {
      ...profile,
      branding: await this.brandingService.getForTenant(profile.tenantId),
    };
  }
}
