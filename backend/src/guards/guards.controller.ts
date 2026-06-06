import { Controller, Get, Post, Put, Body, Param, UseGuards, Query } from '@nestjs/common';
import { GuardsService } from './guards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';

import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('v2/guards')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('guards.view')
export class GuardsController {
  constructor(private readonly guardsService: GuardsService) {}

  @Post()
  @RequirePermission('guards.manage')
  create(
    @GetUser() user: ActiveUser,
    @Body() createGuardDto: CreateGuardDto,
  ) {
    return this.guardsService.create(user, createGuardDto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('branch_id') branchId?: string) {
    return this.guardsService.findAll(user, branchId);
  }

  @Put(':id')
  @RequirePermission('guards.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() updateGuardDto: UpdateGuardDto,
  ) {
    return this.guardsService.update(user, id, updateGuardDto);
  }

  @Get(':id/availability')
  getAvailability(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
  ) {
    return this.guardsService.getAvailability(user, id);
  }

  @Put(':id/availability')
  @RequirePermission('guards.manage')
  updateAvailability(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.guardsService.updateAvailability(user, id, dto);
  }
}
