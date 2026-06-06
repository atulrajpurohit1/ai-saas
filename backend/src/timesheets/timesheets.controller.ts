import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CorrectTimesheetDto } from './dto/correct-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { TimesheetsService } from './timesheets.service';

@Controller('timesheets')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('timesheets.view')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  findAll(
    @GetUser() user: ActiveUser,
    @Query('status') status?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.timesheetsService.findAllForAdmin(user, status, branchId);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.timesheetsService.findOneForAdmin(user, id);
  }

  @Post(':id/approve')
  @RequirePermission('timesheets.approve')
  approve(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.timesheetsService.approve(user, id);
  }

  @Post(':id/reject')
  @RequirePermission('timesheets.approve')
  reject(@GetUser() user: ActiveUser, @Param('id') id: string, @Body() dto: RejectTimesheetDto) {
    return this.timesheetsService.reject(user, id, dto);
  }

  @Put(':id/correct')
  @RequirePermission('timesheets.correct')
  correct(@GetUser() user: ActiveUser, @Param('id') id: string, @Body() dto: CorrectTimesheetDto) {
    return this.timesheetsService.correct(user, id, dto);
  }
}
