import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { SitesService } from './sites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @Roles('admin')
  create(
    @GetUser() user: ActiveUser,
    @Body() createSiteDto: CreateSiteDto,
  ) {
    return this.sitesService.create(user.sub, user.tenantId, createSiteDto);
  }

  @Get()
  @Roles('admin', 'user')
  findAll(@GetUser() user: ActiveUser) {
    return this.sitesService.findAll(user.tenantId);
  }

  @Put(':id')
  @Roles('admin')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
  ) {
    return this.sitesService.update(user.sub, user.tenantId, id, updateSiteDto);
  }
}
