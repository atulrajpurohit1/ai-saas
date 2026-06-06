import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { FinanceInvoiceFilters, FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('finance.view')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('export/invoices')
  @RequirePermission('finance.export')
  async exportInvoices(
    @GetUser() user: ActiveUser,
    @Query() filters: FinanceInvoiceFilters,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.financeService.exportInvoicesCsv(user.tenantId, user.sub, filters);

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': Buffer.byteLength(csv),
    });

    res.end(csv);
  }

  @Get('reports/payments')
  payments(@GetUser() user: ActiveUser, @Query() filters: FinanceInvoiceFilters) {
    return this.financeService.getPaymentReport(user.tenantId, user.sub, filters);
  }

  @Get('reports/outstanding')
  outstanding(@GetUser() user: ActiveUser, @Query() filters: FinanceInvoiceFilters) {
    return this.financeService.getOutstandingReport(user.tenantId, user.sub, filters);
  }

  @Get('reports/disputes')
  disputes(@GetUser() user: ActiveUser, @Query() filters: FinanceInvoiceFilters) {
    return this.financeService.getDisputeReport(user.tenantId, user.sub, filters);
  }

  @Get()
  dashboard(@GetUser() user: ActiveUser, @Query() filters: FinanceInvoiceFilters) {
    return this.financeService.getDashboard(user.tenantId, user.sub, filters);
  }
}
