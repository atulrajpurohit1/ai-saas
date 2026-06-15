import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { UpdateFieldPermissionsDto } from './dto/update-field-permissions.dto';
import { FieldPermissionsService } from './field-permissions.service';

@Controller('field-permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FieldPermissionsController {
  constructor(private readonly fieldPermissionsService: FieldPermissionsService) {}

  @Get('fields')
  @RequirePermission('roles.view')
  listFieldDefinitions() {
    return this.fieldPermissionsService.listFieldDefinitions();
  }

  @Get('effective')
  getEffectivePermissions(
    @GetUser() user: ActiveUser,
    @Query('entity') entity: string,
  ) {
    return this.fieldPermissionsService.getEffectivePermissions(user, entity);
  }

  @Get(':roleId')
  @RequirePermission('roles.view')
  listForRole(@GetUser() user: ActiveUser, @Param('roleId') roleId: string) {
    return this.fieldPermissionsService.listForRole(user, roleId);
  }

  @Put(':roleId')
  @RequirePermission('roles.manage')
  updateRolePermissions(
    @GetUser() user: ActiveUser,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateFieldPermissionsDto,
  ) {
    return this.fieldPermissionsService.updateRolePermissions(user, roleId, dto);
  }
}
