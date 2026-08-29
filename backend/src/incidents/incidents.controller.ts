import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
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
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import {
  INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS,
  ensureIncidentEvidenceUploadDir,
  incidentEvidenceUploadMaxBytes,
  sanitizeFilename,
} from '../common/file-storage.util';
import { ReviewIncidentDto } from './dto/review-incident.dto';
import { IncidentsService } from './incidents.service';

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
  // Fast extension reject; the service additionally verifies the MIME type
  // and the per-media-type size cap once the file is on disk.
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

@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('incidents.view')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('branch_id') branchId?: string) {
    return this.incidentsService.findAllForAdmin(user, branchId);
  }

  @Get('review-queue')
  findReviewQueue(
    @GetUser() user: ActiveUser,
    @Query('branch_id') branchId?: string,
  ) {
    return this.incidentsService.findReviewQueueForAdmin(user, branchId);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.incidentsService.findOneForAdmin(user, id);
  }

  @Post(':id/review')
  @RequirePermission('incidents.review')
  review(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: ReviewIncidentDto,
  ) {
    return this.incidentsService.reviewIncident(user, id, dto);
  }

  // --- Phase 3F: evidence attachments ---------------------------------------

  @Get(':id/evidence')
  listEvidence(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.incidentsService.listEvidenceForAdmin(user, id);
  }

  @Post(':id/evidence')
  @RequirePermission('incidents.review')
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
    if (!file) throw new BadRequestException('No file uploaded');
    return this.incidentsService.addEvidenceForAdmin(user, id, file);
  }

  @Get(':id/evidence/:evidenceId/file')
  async downloadEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const { stream, mimeType, fileName, fileSizeBytes } =
      await this.incidentsService.getEvidenceFileForAdmin(user, id, evidenceId);

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Length': String(fileSizeBytes),
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, no-store',
    });
    stream.pipe(res);
  }

  @Delete(':id/evidence/:evidenceId')
  @RequirePermission('incidents.review')
  deleteEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.incidentsService.deleteEvidenceForAdmin(user, id, evidenceId);
  }
}
