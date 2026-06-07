import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BrandingService } from './branding.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get('public')
  publicBranding(
    @Query('domain') domain: string | undefined,
    @Query('tenant_slug') tenantSlug: string | undefined,
    @Req() req: Request,
  ) {
    return this.brandingService.getPublicBranding({
      domain: domain || req.headers.host,
      tenantSlug,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('branding.view')
  getBranding(@GetUser() user: ActiveUser) {
    return this.brandingService.getForUser(user);
  }

  @Put()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('branding.manage')
  updateBranding(@GetUser() user: ActiveUser, @Body() dto: UpdateBrandingDto) {
    return this.brandingService.updateBranding(user, dto);
  }

  @Get('domains')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('domains.view')
  listDomains(@GetUser() user: ActiveUser) {
    return this.brandingService.listDomains(user);
  }

  @Post('domains')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('domains.manage')
  addDomain(@GetUser() user: ActiveUser, @Body() dto: CreateDomainDto) {
    return this.brandingService.addDomain(user, dto);
  }

  @Post('domains/:id/verify')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('domains.manage')
  verifyDomain(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.brandingService.verifyDomain(user, id);
  }
}
