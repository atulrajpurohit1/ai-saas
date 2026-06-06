import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GenerateDailyReportDto } from './dto/generate-daily-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('reports.view')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate-daily')
  @RequirePermission('reports.create')
  generateDailyReport(@GetUser() user: ActiveUser, @Body() dto: GenerateDailyReportDto) {
    return this.reportsService.generateDailyReport(user, dto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('branch_id') branchId?: string) {
    return this.reportsService.findAllForAdmin(user, branchId);
  }

  @Get(':id/export-pdf')
  @RequirePermission('reports.export')
  async exportPdf(@GetUser() user: ActiveUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer } = await this.reportsService.exportForAdmin(user, id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=daily-report-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.reportsService.findOneForAdmin(user, id);
  }

  @Post(':id/publish')
  @RequirePermission('reports.publish')
  publish(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.reportsService.publishReport(user, id);
  }
}
