import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CorrectTimesheetDto } from './dto/correct-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { TimesheetsService } from './timesheets.service';

@Controller('timesheets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('status') status?: string) {
    return this.timesheetsService.findAllForAdmin(user.tenantId, status);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.timesheetsService.findOneForAdmin(user.tenantId, id);
  }

  @Post(':id/approve')
  approve(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.timesheetsService.approve({
      tenantId: user.tenantId,
      userId: user.sub,
      userRole: user.role,
      guardId: user.guardId,
      timesheetId: id,
    });
  }

  @Post(':id/reject')
  reject(@GetUser() user: ActiveUser, @Param('id') id: string, @Body() dto: RejectTimesheetDto) {
    return this.timesheetsService.reject(user.tenantId, user.sub, id, dto);
  }

  @Put(':id/correct')
  correct(@GetUser() user: ActiveUser, @Param('id') id: string, @Body() dto: CorrectTimesheetDto) {
    return this.timesheetsService.correct(user.tenantId, user.sub, id, dto);
  }
}
