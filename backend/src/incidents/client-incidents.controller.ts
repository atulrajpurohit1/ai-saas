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
import { IncidentsService } from './incidents.service';

@Controller('client/incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('client')
export class ClientIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

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
    return this.incidentsService.findApprovedForClient(
      tenantId,
      clientId,
      userId,
    );
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, clientId, userId } = this.getClientContext(user);
    return this.incidentsService.findApprovedDetailForClient(
      tenantId,
      clientId,
      userId,
      id,
    );
  }

  // --- Phase 3F: evidence attachments (read-only for clients) --------------

  @Get(':id/evidence')
  listEvidence(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, clientId, userId } = this.getClientContext(user);
    return this.incidentsService.listEvidenceForClient(
      tenantId,
      clientId,
      userId,
      id,
    );
  }

  @Get(':id/evidence/:evidenceId/file')
  async downloadEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const { tenantId, clientId } = this.getClientContext(user);
    const { stream, mimeType, fileName, fileSizeBytes } =
      await this.incidentsService.getEvidenceFileForClient(
        tenantId,
        clientId,
        id,
        evidenceId,
      );

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Length': String(fileSizeBytes),
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, no-store',
    });
    stream.pipe(res);
  }
}
