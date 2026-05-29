import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CloseInvoiceDisputeDto, RespondInvoiceDisputeDto } from './dto/respond-invoice-dispute.dto';
import { InvoiceDisputesService } from './invoice-disputes.service';

@Controller('invoice-disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
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
  respond(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: RespondInvoiceDisputeDto,
  ) {
    return this.invoiceDisputesService.respond(user.tenantId, user.sub, id, dto);
  }

  @Post(':id/resolve')
  resolve(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: CloseInvoiceDisputeDto,
  ) {
    return this.invoiceDisputesService.resolve(user.tenantId, user.sub, id, dto);
  }

  @Post(':id/reject')
  reject(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: CloseInvoiceDisputeDto,
  ) {
    return this.invoiceDisputesService.reject(user.tenantId, user.sub, id, dto);
  }
}
