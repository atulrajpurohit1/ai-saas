import { Controller, ForbiddenException, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { InvoicesService } from './invoices.service';

@Controller('client/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('client')
export class ClientInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  private getClientContext(user: ActiveUser) {
    if (user.role !== 'client' || !user.clientId || !user.tenantId) {
      throw new ForbiddenException('Client access required');
    }

    return {
      tenantId: user.tenantId,
      clientId: user.clientId,
      userId: user.sub,
    };
  }

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    const { tenantId, clientId } = this.getClientContext(user);
    return this.invoicesService.findAllForClient(tenantId, clientId);
  }

  @Get(':id/download')
  async download(@GetUser() user: ActiveUser, @Param('id') id: string, @Res() res: Response) {
    const { tenantId, clientId, userId } = this.getClientContext(user);
    const { buffer, invoice } = await this.invoicesService.downloadForClient(tenantId, clientId, userId, id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${invoice.invoiceNumber}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, clientId } = this.getClientContext(user);
    return this.invoicesService.findOneForClient(tenantId, clientId, id);
  }
}
