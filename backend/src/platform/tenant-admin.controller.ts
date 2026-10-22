import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../platform-auth/guards/platform-admin.guard';
import { GetPlatformAdmin } from '../platform-auth/decorators/get-platform-admin.decorator';
import { ActivePlatformAdmin } from '../platform-auth/interfaces/active-platform-admin.interface';
import { TenantAdminService } from './tenant-admin.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { DeleteTenantDto } from './dto/delete-tenant.dto';
import { SuspendTenantDto } from './dto/suspend-tenant.dto';

/**
 * Tenant lifecycle, for the platform owner only.
 *
 * Every route is behind PlatformAdminGuard, which requires a token signed with
 * the platform secret. No tenant session can reach any of this, regardless of
 * what role or flags that session carries.
 */
@UseGuards(PlatformAdminGuard)
@Controller('platform/tenants')
export class TenantAdminController {
  constructor(private readonly tenants: TenantAdminService) {}

  @Post()
  create(
    @Body() dto: CreateTenantDto,
    @GetPlatformAdmin() admin: ActivePlatformAdmin,
  ) {
    return this.tenants.createTenant(dto, admin.adminId);
  }

  @Post(':tenantId/suspend')
  @HttpCode(200)
  suspend(
    @Param('tenantId') tenantId: string,
    @Body() dto: SuspendTenantDto,
    @GetPlatformAdmin() admin: ActivePlatformAdmin,
  ) {
    return this.tenants.suspendTenant(tenantId, dto, admin.adminId);
  }

  @Post(':tenantId/reactivate')
  @HttpCode(200)
  reactivate(
    @Param('tenantId') tenantId: string,
    @GetPlatformAdmin() admin: ActivePlatformAdmin,
  ) {
    return this.tenants.reactivateTenant(tenantId, admin.adminId);
  }

  /**
   * Permanent, cascading delete. The body must echo the tenant's exact name;
   * the service rejects a mismatch, so this cannot be done by accident or by
   * a caller that skipped the confirmation dialog.
   */
  @Delete(':tenantId')
  @HttpCode(200)
  remove(
    @Param('tenantId') tenantId: string,
    @Body() dto: DeleteTenantDto,
    @GetPlatformAdmin() admin: ActivePlatformAdmin,
  ) {
    return this.tenants.deleteTenant(tenantId, dto, admin.adminId);
  }
}
