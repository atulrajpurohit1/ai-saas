import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CloseInvoiceDisputeDto, RespondInvoiceDisputeDto } from './dto/respond-invoice-dispute.dto';
import { InvoiceDisputesService } from './invoice-disputes.service';

@Controller('invoice-disputes')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('invoice_disputes.view')
export class InvoiceDisputesController {
  constructor(private readonly invoiceDisputesService: InvoiceDisputesService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.invoiceDisputesService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.invoiceDisputesService.findOne(user.tenantId, user.sub, id);
  }

  @Post(':id/respond')
  @RequirePermission('invoice_disputes.respond')
  respond(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: RespondInvoiceDisputeDto,
  ) {
    return this.invoiceDisputesService.respond(user.tenantId, user.sub, id, dto);
  }

  @Post(':id/resolve')
  @RequirePermission('invoice_disputes.respond')
  resolve(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: CloseInvoiceDisputeDto,
  ) {
    return this.invoiceDisputesService.resolve(user.tenantId, user.sub, id, dto);
  }

  @Post(':id/reject')
  @RequirePermission('invoice_disputes.respond')
  reject(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: CloseInvoiceDisputeDto,
  ) {
    return this.invoiceDisputesService.reject(user.tenantId, user.sub, id, dto);
  }
}
