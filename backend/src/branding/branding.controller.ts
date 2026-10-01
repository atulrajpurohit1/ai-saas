import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BrandingService } from './branding.service';

@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get('public')
  getPublicBranding(
    @Query('domain') domain?: string,
    @Query('tenant_slug') tenantSlug?: string,
  ) {
    return this.brandingService.getPublicBranding({ domain, tenantSlug });
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('branding.view')
  getBranding(@GetUser() user: ActiveUser) {
    return this.brandingService.getForUser(user);
  }

  // Branding is fixed for every tenant: there are deliberately no endpoints
  // that change it or its custom domains. A settings page used to let any
  // admin restyle the product; the client asked on 1 Oct 2026 that no one be
  // able to. Removing the routes, not just the page, is what enforces that --
  // a hidden page still leaves the API open. Reads stay, because every page
  // and email renders with the stored branding.
}
