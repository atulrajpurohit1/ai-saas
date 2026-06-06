import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireAnyPermission, RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AssignUserRoleDto } from './dto/assign-user-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions')
  @RequirePermission('roles.view')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get()
  @RequirePermission('roles.view')
  listRoles(@GetUser() user: ActiveUser) {
    return this.rolesService.listRoles(user);
  }

  @Post()
  @RequirePermission('roles.manage')
  createRole(@GetUser() user: ActiveUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(user, dto);
  }

  @Put(':id')
  @RequirePermission('roles.manage')
  updateRole(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.updateRole(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('roles.manage')
  deactivateRole(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rolesService.deactivateRole(user, id);
  }

  @Get('users')
  @RequireAnyPermission('users.view', 'users.assign_roles')
  listUsers(@GetUser() user: ActiveUser) {
    return this.rolesService.listUsers(user);
  }

  @Post('assignments')
  @RequirePermission('users.assign_roles')
  assignRole(@GetUser() user: ActiveUser, @Body() dto: AssignUserRoleDto) {
    return this.rolesService.assignRole(user, dto);
  }

  @Delete('assignments/:id')
  @RequirePermission('users.assign_roles')
  revokeAssignment(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rolesService.revokeAssignment(user, id);
  }
}
