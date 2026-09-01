import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ClientComplianceService } from './client-compliance.service';

// Client-portal facing. Read-only. tenantId + clientId are ALWAYS taken from
// the authenticated client's JWT - never from a route param or body - so a
// client can only ever reach their own client-wide and own-site policies.
@Controller('client/insurance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('client')
export class ClientPortalInsuranceController {
  constructor(
    private readonly clientComplianceService: ClientComplianceService,
  ) {}

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
    const { tenantId, clientId, userId } = this.getClientContext(user);
    return this.clientComplianceService.findAllForClient(
      tenantId,
      clientId,
      userId,
    );
  }

  @Get(':id/document')
  async downloadDocument(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { tenantId, clientId } = this.getClientContext(user);
    const { stream, filename } =
      await this.clientComplianceService.getDocumentForClient(
        tenantId,
        clientId,
        id,
      );

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'private, no-store',
    });
    stream.pipe(res);
  }
}
