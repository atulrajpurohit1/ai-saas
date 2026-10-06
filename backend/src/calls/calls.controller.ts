import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { CallsService } from './calls.service';
import { LogCallDto } from './dto/log-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import {
  CALL_RECORDING_ALLOWED_EXTENSIONS,
  callRecordingUploadMaxBytes,
  ensureCallRecordingUploadDir,
  sanitizeFilename,
} from '../common/file-storage.util';

const recordingFileStorage = diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, ensureCallRecordingUploadDir());
  },
  filename: (_req, file, callback) => {
    const unique = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    callback(null, `${unique}-${sanitizeFilename(file.originalname)}`);
  },
});

function recordingFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  // Fast extension reject; the service also checks the MIME type.
  if (!CALL_RECORDING_ALLOWED_EXTENSIONS.test(file.originalname)) {
    callback(
      new BadRequestException(
        'Unsupported recording type. Allowed: M4A, MP3, WAV, AAC, AMR, 3GP, WebM, OGG.',
      ),
      false,
    );
    return;
  }
  callback(null, true);
}

@UseGuards(JwtAuthGuard, PermissionGuard, ModuleGuard)
@Controller('calls')
@RequireModule('LEAD_GEN')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post()
  @RequirePermission('calls.create')
  logCall(@Body() dto: LogCallDto, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.logCall(dto, user.tenantId, user.sub);
  }

  @Get()
  @RequirePermission('calls.view')
  findAll(
    @Req() req: Request,
    @Query('leadId') leadId?: string,
    @Query('dealId') dealId?: string,
    @Query('limit') limit?: string,
    @Query('hasRecording') hasRecording?: string,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.findAll(user.tenantId, {
      leadId,
      dealId,
      limit: limit ? parseInt(limit, 10) || undefined : undefined,
      hasRecording: hasRecording === 'true',
    });
  }

  @Get(':id')
  @RequirePermission('calls.view')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('calls.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCallDto,
    @Req() req: Request,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.update(id, dto, user.tenantId, user.sub);
  }

  /**
   * Audio the rep's browser recorded during the call. Gated on calls.update
   * because it amends the call record, same as the outcome and transcript.
   */
  @Post(':id/recording')
  @RequirePermission('calls.update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: recordingFileStorage,
      fileFilter: recordingFileFilter,
      limits: { fileSize: callRecordingUploadMaxBytes() },
    }),
  )
  uploadRecording(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('durationSec') durationSec: string | undefined,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('No recording uploaded');
    const user = req.user as unknown as ActiveUser;
    const parsed = durationSec !== undefined ? Number(durationSec) : undefined;
    return this.callsService.attachRecording(
      id,
      file,
      user.tenantId,
      user.sub,
      parsed,
    );
  }

  @Get(':id/recording')
  @RequirePermission('calls.view')
  async downloadRecording(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as unknown as ActiveUser;
    const { stream, mimeType, fileName, fileSizeBytes } =
      await this.callsService.getRecordingFile(id, user.tenantId);

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      ...(fileSizeBytes ? { 'Content-Length': String(fileSizeBytes) } : {}),
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, no-store',
    });
    stream.pipe(res);
  }

  /** Deletes the audio only; the call stays in the log. */
  @Delete(':id/recording')
  @RequirePermission('calls.delete')
  removeRecording(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.removeRecording(id, user.tenantId, user.sub);
  }

  @Delete(':id')
  @RequirePermission('calls.delete')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.remove(id, user.tenantId, user.sub);
  }
}
