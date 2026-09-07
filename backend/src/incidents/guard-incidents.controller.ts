import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import {
  INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS,
  ensureIncidentEvidenceUploadDir,
  incidentEvidenceUploadMaxBytes,
  sanitizeFilename,
} from '../common/file-storage.util';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';

// Identical disk-storage + fast extension filter used by the admin
// incident-evidence endpoints (IncidentsController). The service re-verifies
// the MIME type and the per-media-type size cap once the file is on disk.
const evidenceFileStorage = diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, ensureIncidentEvidenceUploadDir());
  },
  filename: (_req, file, callback) => {
    const unique = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    callback(null, `${unique}-${sanitizeFilename(file.originalname)}`);
  },
});

function evidenceFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS.test(file.originalname)) {
    callback(
      new BadRequestException(
        `Unsupported file type for "${file.originalname}". Allowed: JPG, PNG, WEBP, GIF, HEIC, MP4, MOV, M4V, WEBM.`,
      ),
      false,
    );
    return;
  }
  callback(null, true);
}

@Controller('guard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('guard')
export class GuardIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  private getGuardContext(user: ActiveUser) {
    if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
      throw new ForbiddenException('Guard access required');
    }

    return {
      tenantId: user.tenantId,
      guardId: user.guardId,
    };
  }

  @Post('shifts/:id/incidents')
  createForShift(
    @GetUser() user: ActiveUser,
    @Param('id') shiftId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.incidentsService.createForGuard(
      tenantId,
      guardId,
      shiftId,
      dto,
    );
  }

  @Get('incidents')
  findMine(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.incidentsService.findForGuard(tenantId, guardId);
  }

  // --- Phase 3H: photo/video evidence on an incident the guard reported ---

  @Post('incidents/:id/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: evidenceFileStorage,
      fileFilter: evidenceFileFilter,
      limits: { fileSize: incidentEvidenceUploadMaxBytes() },
    }),
  )
  uploadEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    if (!file) throw new BadRequestException('No file uploaded');
    return this.incidentsService.addEvidenceForGuard(
      tenantId,
      guardId,
      id,
      file,
    );
  }

  @Get('incidents/:id/evidence')
  listEvidence(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.incidentsService.listEvidenceForGuard(tenantId, guardId, id);
  }

  @Get('incidents/:id/evidence/:evidenceId/file')
  async downloadEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    const { stream, mimeType, fileName, fileSizeBytes } =
      await this.incidentsService.getEvidenceFileForGuard(
        tenantId,
        guardId,
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
