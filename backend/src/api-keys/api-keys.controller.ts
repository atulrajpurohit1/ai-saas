import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireAnyPermission, RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get('permissions')
  @RequireAnyPermission('api_keys.view', 'api_keys.manage')
  listPermissionDefinitions() {
    return this.apiKeysService.listPermissionDefinitions();
  }

  @Get()
  @RequirePermission('api_keys.view')
  list(@GetUser() user: ActiveUser) {
    return this.apiKeysService.list(user);
  }

  @Post()
  @RequirePermission('api_keys.manage')
  create(@GetUser() user: ActiveUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('api_keys.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.apiKeysService.update(user, id, dto);
  }

  @Post(':id/revoke')
  @RequirePermission('api_keys.manage')
  revoke(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user, id);
  }

  @Post(':id/regenerate')
  @RequirePermission('api_keys.manage')
  regenerate(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.apiKeysService.regenerate(user, id);
  }
}
