import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../auth/guards/plan.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AssignGuardDto } from './dto/assign-guard.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { Param, Put, Delete } from '@nestjs/common';

@Controller('v2/shifts')
@UseGuards(JwtAuthGuard, PlanGuard, PermissionGuard, ModuleGuard)
@RequirePermission('shifts.view')
@RequireModule('FINANCE')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @RequirePermission('shifts.create')
  create(@GetUser() user: ActiveUser, @Body() createShiftDto: CreateShiftDto) {
    return this.shiftsService.create(user, createShiftDto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('branch_id') branchId?: string) {
    return this.shiftsService.findAll(user, branchId);
  }

  @Put(':id')
  @RequirePermission('shifts.create')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shiftsService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('shifts.delete')
  remove(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.shiftsService.remove(user, id);
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

  /** Removes every guard from the shift. */
  @Delete(':id/unassign')
  @RequirePermission('shifts.assign')
  unassign(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.shiftsService.unassign(user, id);
  }

  /** Removes one guard from a multi-guard shift. */
  @Delete(':id/unassign/:guardId')
  @RequirePermission('shifts.assign')
  unassignGuard(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Param('guardId') guardId: string,
  ) {
    return this.shiftsService.unassign(user, id, guardId);
  }
}
