import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate')
  generate(@GetUser() user: ActiveUser, @Body() dto: GenerateInvoiceDto) {
    return this.invoicesService.generateInvoice(user, dto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('branch_id') branchId?: string) {
    return this.invoicesService.findAllForAdmin(user, branchId);
  }

  @Get(':id/export-pdf')
  async exportPdf(@GetUser() user: ActiveUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, invoice } = await this.invoicesService.exportForAdmin(user, id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${invoice.invoiceNumber}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.invoicesService.findOneForAdmin(user, id);
  }

  @Post(':id/issue')
  issue(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.invoicesService.issueInvoice(user, id);
  }

  @Post(':id/mark-paid')
  markPaid(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.invoicesService.markPaid(user, id);
  }

  @Post(':id/cancel')
  cancel(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.invoicesService.cancelInvoice(user, id);
  }
}
