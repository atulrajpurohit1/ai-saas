import { Controller, Get, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { RequireAnyPermission, RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CrmConnectorsService } from './crm-connectors.service';

@Controller('crm-connectors')
export class CrmConnectorsController {
  constructor(private readonly crmConnectorsService: CrmConnectorsService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyPermission('integrations.view', 'crm.view')
  getStatus(@GetUser() user: ActiveUser) {
    return this.crmConnectorsService.getStatus(user);
  }

  @Get('hubspot/connect-url')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyPermission('integrations.manage', 'crm.manage')
  getHubSpotConnectUrl(@GetUser() user: ActiveUser) {
    return this.crmConnectorsService.getHubSpotConnectUrl(user);
  }

  @Get('hubspot/callback')
  @Redirect()
  async hubSpotCallback(@Query('code') code?: string, @Query('state') state?: string) {
    try {
      await this.crmConnectorsService.handleHubSpotCallback(code, state);
      return { url: this.crmConnectorsService.hubSpotResultUrl(true) };
    } catch {
      return { url: this.crmConnectorsService.hubSpotResultUrl(false) };
    }
  }

  @Post('hubspot/import-contacts')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyPermission('integrations.manage', 'crm.manage', 'leads.import')
  importHubSpotContacts(@GetUser() user: ActiveUser) {
    return this.crmConnectorsService.importHubSpotContacts(user);
  }

  @Post('hubspot/disconnect')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('integrations.manage')
  disconnectHubSpot(@GetUser() user: ActiveUser) {
    return this.crmConnectorsService.disconnectHubSpot(user);
  }
}
