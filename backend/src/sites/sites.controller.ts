import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../auth/guards/plan.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SetAutoAssignmentDto } from './dto/set-auto-assignment.dto';

@Controller('sites')
@UseGuards(JwtAuthGuard, PlanGuard, PermissionGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @RequirePermission('sites.manage')
  create(@GetUser() user: ActiveUser, @Body() createSiteDto: CreateSiteDto) {
    return this.sitesService.create(user, createSiteDto);
  }

  @Get()
  @RequireAnyPermission('sites.view', 'shifts.create', 'invoices.generate')
  findAll(@GetUser() user: ActiveUser, @Query('branch_id') branchId?: string) {
    return this.sitesService.findAll(user, branchId);
  }

  @Put(':id')
  @RequirePermission('sites.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
  ) {
    return this.sitesService.update(user, id, updateSiteDto);
  }

  @Put(':id/auto-assignment')
  @RequirePermission('sites.manage')
  setAutoAssignment(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: SetAutoAssignmentDto,
  ) {
    return this.sitesService.setAutoAssignment(user, id, dto.enabled);
  }
}
