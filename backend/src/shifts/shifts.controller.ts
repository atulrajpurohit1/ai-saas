import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AssignGuardDto } from './dto/assign-guard.dto';
import { Param, Put, Delete } from '@nestjs/common';

@Controller('v2/shifts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('shifts.view')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @RequirePermission('shifts.create')
  create(
    @GetUser() user: ActiveUser,
    @Body() createShiftDto: CreateShiftDto,
  ) {
    return this.shiftsService.create(user, createShiftDto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('branch_id') branchId?: string) {
    return this.shiftsService.findAll(user, branchId);
  }

  @Get(':id/recommend-guards')
  @RequirePermission('shifts.assign')
  recommendGuards(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.shiftsService.recommendGuards(user, id);
  }

  @Put(':id/assign')
  @RequirePermission('shifts.assign')
  assign(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: AssignGuardDto,
  ) {
    return this.shiftsService.assign(user, id, dto.guardId);
  }

  @Delete(':id/unassign')
  @RequirePermission('shifts.assign')
  unassign(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.shiftsService.unassign(user, id);
  }
}
