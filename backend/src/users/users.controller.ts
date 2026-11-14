import { Body, Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { RolesService } from '../roles/roles.service';
import { BrandingService } from '../branding/branding.service';
import { MarkModuleWelcomeDto } from './dto/mark-module-welcome.dto';

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

  /**
   * Records that the caller has seen a service's one-time welcome dialog.
   *
   * Sits on this controller, which `plan-coverage.spec.ts` exempts from
   * PlanGuard, and that is deliberate rather than an oversight: it writes a
   * single UI flag on the caller's OWN row, reads nothing back but that flag,
   * and discloses no tenant data. A tenant with no plan never sees a welcome
   * to dismiss, so gating it would only add a way for the write to fail after
   * the dialog had already closed.
   */
  @Post('me/module-welcome')
  markModuleWelcome(
    @GetUser() user: ActiveUser,
    @Body() dto: MarkModuleWelcomeDto,
  ) {
    return this.rolesService.markModuleWelcomeSeen(user, dto.module);
  }
}
