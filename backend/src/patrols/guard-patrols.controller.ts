import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { Response } from 'express';
import { PatrolsService } from './patrols.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import {
  PATROL_EVIDENCE_ALLOWED_EXTENSIONS,
  ensurePatrolEvidenceUploadDir,
  patrolEvidenceImageMaxBytes,
  sanitizeFilename,
} from '../common/file-storage.util';
import { StartPatrolRunDto } from './dto/start-patrol-run.dto';
import { ScanCheckpointDto } from './dto/scan-checkpoint.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

// Same disk-storage + fast extension filter used by the incident-evidence
// and guard-compliance upload endpoints. The service re-verifies the MIME
// type and the size cap once the file is on disk.
const patrolEvidenceFileStorage = diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, ensurePatrolEvidenceUploadDir());
  },
  filename: (_req, file, callback) => {
    const unique = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    callback(null, `${unique}-${sanitizeFilename(file.originalname)}`);
  },
});

function patrolEvidenceFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!PATROL_EVIDENCE_ALLOWED_EXTENSIONS.test(file.originalname)) {
    callback(
      new BadRequestException(
        `Unsupported file type for "${file.originalname}". Allowed: JPG, PNG, WEBP, GIF, HEIC.`,
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
export class GuardPatrolsController {
  constructor(private readonly patrolsService: PatrolsService) {}

  private getGuardContext(user: ActiveUser) {
    if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
      throw new ForbiddenException('Guard access required');
    }

    return {
      tenantId: user.tenantId,
      guardId: user.guardId,
    };
  }

  @Get('shifts/:id/patrol-routes')
  getShiftPatrolRoutes(
    @GetUser() user: ActiveUser,
    @Param('id') shiftId: string,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.getShiftPatrolRoutes(tenantId, guardId, shiftId);
  }

  @Post('shifts/:id/patrol-runs/start')
  startPatrolRun(
    @GetUser() user: ActiveUser,
    @Param('id') shiftId: string,
    @Body() dto: StartPatrolRunDto,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.startPatrolRun(tenantId, guardId, shiftId, dto);
  }

  @Post('patrol-runs/:id/checkpoints/:checkpointId/scan')
  scanCheckpoint(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
    @Param('checkpointId') checkpointId: string,
    @Body() dto: ScanCheckpointDto,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.scanCheckpoint(
      tenantId,
      guardId,
      runId,
      checkpointId,
      dto,
    );
  }

  @Post('patrol-runs/:id/location')
  updateLocation(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.updateLocation(tenantId, guardId, runId, dto);
  }

  @Post('patrol-runs/:id/complete')
  completePatrolRun(@GetUser() user: ActiveUser, @Param('id') runId: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.completePatrolRun(tenantId, guardId, runId);
  }

  @Get('patrol-runs')
  getGuardPatrolRuns(@GetUser() user: ActiveUser) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.getGuardPatrolRuns(tenantId, guardId);
  }

  @Get('patrol-runs/:id')
  getGuardPatrolRun(@GetUser() user: ActiveUser, @Param('id') runId: string) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.getGuardPatrolRun(tenantId, guardId, runId);
  }

  // --- Phase 3H: checkpoint photo evidence --------------------------------
  // The guard attaches a photo to a checkpoint scan they just performed
  // (identified by the PatrolEvent id returned from the scan call). The
  // patrol run must still be in_progress to add evidence; already-attached
  // evidence stays readable afterwards.

  @Post('patrol-runs/:id/events/:eventId/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: patrolEvidenceFileStorage,
      fileFilter: patrolEvidenceFileFilter,
      limits: { fileSize: patrolEvidenceImageMaxBytes() },
    }),
  )
  uploadCheckpointEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    if (!file) throw new BadRequestException('No file uploaded');
    return this.patrolsService.addCheckpointEvidenceForGuard(
      tenantId,
      guardId,
      runId,
      eventId,
      file,
    );
  }

  @Get('patrol-runs/:id/events/:eventId/evidence')
  listCheckpointEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
    @Param('eventId') eventId: string,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    return this.patrolsService.listCheckpointEvidenceForGuard(
      tenantId,
      guardId,
      runId,
      eventId,
    );
  }

  @Get('patrol-runs/:id/events/:eventId/evidence/:evidenceId/file')
  async downloadCheckpointEvidence(
    @GetUser() user: ActiveUser,
    @Param('id') runId: string,
    @Param('eventId') eventId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const { tenantId, guardId } = this.getGuardContext(user);
    const { stream, mimeType, fileName, fileSizeBytes } =
      await this.patrolsService.getCheckpointEvidenceFileForGuard(
        tenantId,
        guardId,
        runId,
        eventId,
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
