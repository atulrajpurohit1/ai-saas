import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GenerateDailyReportDto } from './dto/generate-daily-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate-daily')
  generateDailyReport(@GetUser() user: ActiveUser, @Body() dto: GenerateDailyReportDto) {
    return this.reportsService.generateDailyReport(user.tenantId, user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.reportsService.findAllForAdmin(user.tenantId);
  }

  @Get(':id/export-pdf')
  async exportPdf(@GetUser() user: ActiveUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer } = await this.reportsService.exportForAdmin(user.tenantId, user.sub, id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=daily-report-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.reportsService.findOneForAdmin(user.tenantId, user.sub, id);
  }

  @Post(':id/publish')
  publish(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.reportsService.publishReport(user.tenantId, user.sub, id);
  }
}
