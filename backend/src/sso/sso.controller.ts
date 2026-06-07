import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateSSOProviderDto } from './dto/create-sso-provider.dto';
import { SSOTestDto } from './dto/sso-login.dto';
import { UpdateSSOProviderDto } from './dto/update-sso-provider.dto';
import { SsoService } from './sso.service';

@Controller('sso')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('providers')
  @RequirePermission('sso.view')
  listProviders(@GetUser() user: ActiveUser) {
    return this.ssoService.listProviders(user);
  }

  @Post('providers')
  @RequirePermission('sso.manage')
  createProvider(@GetUser() user: ActiveUser, @Body() dto: CreateSSOProviderDto) {
    return this.ssoService.createProvider(user, dto);
  }

  @Put('providers/:id')
  @RequirePermission('sso.manage')
  updateProvider(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateSSOProviderDto,
  ) {
    return this.ssoService.updateProvider(user, id, dto);
  }

  @Post('test')
  @RequirePermission('sso.manage')
  testProvider(@GetUser() user: ActiveUser, @Body() dto: SSOTestDto) {
    return this.ssoService.testProvider(user, dto);
  }
}
