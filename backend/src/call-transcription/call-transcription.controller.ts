import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CallTranscriptionService } from './call-transcription.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('call-transcription')
export class CallTranscriptionController {
  constructor(private readonly callTranscriptionService: CallTranscriptionService) {}

  @Get('status')
  @RequireAnyPermission('ai.view', 'leads.view', 'deals.view')
  status() {
    return this.callTranscriptionService.getStatus();
  }

  @Post('transcribe')
  @RequireAnyPermission('ai.view', 'leads.view', 'deals.view')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  transcribe(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No audio file uploaded');
    return this.callTranscriptionService.transcribe(file);
  }
}
