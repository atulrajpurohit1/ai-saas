import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BillingService } from './billing.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @RequireAnyPermission('billing.view', 'roles.view', 'users.view')
  getBilling(@GetUser() user: ActiveUser) {
    return this.billingService.getTenantBilling(user.tenantId);
  }
}
