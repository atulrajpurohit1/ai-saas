import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CrmConnectorsService } from './crm-connectors.service';
import { ConnectCredentialsDto } from './dto/connect-credentials.dto';
import { SyncContactDto } from './dto/sync-contact.dto';

@Controller('crm-connectors')
export class CrmConnectorsController {
  constructor(private readonly crmConnectorsService: CrmConnectorsService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyPermission('integrations.view', 'crm.view')
  getStatus(@GetUser() user: ActiveUser) {
    return this.crmConnectorsService.getStatus(user);
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyPermission('integrations.view', 'crm.view')
  listProviders() {
    return this.crmConnectorsService.listProviders();
  }

  @Post(':provider/connect')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyPermission('integrations.manage', 'crm.manage')
  connectWithCredentials(
    @GetUser() user: ActiveUser,
    @Param('provider') provider: string,
    @Body() dto: ConnectCredentialsDto,
  ) {
    return this.crmConnectorsService.connectWithCredentials(user, provider, dto);
  }

  @Get(':provider/connect-url')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyPermission('integrations.manage', 'crm.manage')
  getConnectUrl(@GetUser() user: ActiveUser, @Param('provider') provider: string) {
    return this.crmConnectorsService.getConnectUrl(user, provider);
  }

  @Get(':provider/callback')
  @Redirect()
  async callback(
    @Param('provider') provider: string,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    try {
      await this.crmConnectorsService.handleCallback(provider, code, state);
      return { url: this.crmConnectorsService.callbackResultUrl(provider, true) };
    } catch {
      return { url: this.crmConnectorsService.callbackResultUrl(provider, false) };
    }
  }

  // Writes Lead rows, so it is Lead Gen -- not Integrations.
  //
  // 'integrations.manage' is enough to satisfy the permission guard and sits
  // on the CORE integrations module, so without @RequireModule any account
  // could connect a CRM and import its whole contact list as leads having
  // bought nothing. The leads controller was gated from the start; this was
  // the side door into the same table.
  @Post(':provider/import-contacts')
  @UseGuards(JwtAuthGuard, PermissionGuard, ModuleGuard)
  @RequireModule('LEAD_GEN')
  @RequireAnyPermission('integrations.manage', 'crm.manage', 'leads.import')
  importContacts(@GetUser() user: ActiveUser, @Param('provider') provider: string) {
    return this.crmConnectorsService.importContacts(user, provider);
  }

  @Post(':provider/disconnect')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('integrations.manage')
  disconnect(@GetUser() user: ActiveUser, @Param('provider') provider: string) {
    return this.crmConnectorsService.disconnect(user, provider);
  }

  // Same table as import-contacts, one record at a time; same gate.
  @Post(':provider/contacts')
  @UseGuards(JwtAuthGuard, PermissionGuard, ModuleGuard)
  @RequireModule('LEAD_GEN')
  @RequireAnyPermission('integrations.manage', 'crm.manage', 'leads.import')
  syncContact(
    @GetUser() user: ActiveUser,
    @Param('provider') provider: string,
    @Body() dto: SyncContactDto,
  ) {
    return this.crmConnectorsService.importProspectContact(user, provider, dto);
  }
}
