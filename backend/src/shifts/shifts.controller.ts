import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AssignGuardDto } from './dto/assign-guard.dto';
import { Param, Put, Delete } from '@nestjs/common';

@Controller('v2/shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  create(
    @GetUser() user: ActiveUser,
    @Body() createShiftDto: CreateShiftDto,
  ) {
    return this.shiftsService.create(user.sub, user.tenantId, createShiftDto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.shiftsService.findAll(user.tenantId);
  }

  @Put(':id/assign')
  assign(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: AssignGuardDto,
  ) {
    return this.shiftsService.assign(user.sub, user.tenantId, id, dto.guardId);
  }

  @Delete(':id/unassign')
  unassign(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.shiftsService.unassign(user.sub, user.tenantId, id);
  }
}
