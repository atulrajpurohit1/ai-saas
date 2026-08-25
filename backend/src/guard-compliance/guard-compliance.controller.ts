import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import {
  GUARD_COMPLIANCE_UPLOAD_ALLOWED_EXTENSIONS,
  ensureGuardComplianceUploadDir,
  guardComplianceUploadMaxBytes,
  sanitizeFilename,
} from '../common/file-storage.util';
import { GuardComplianceService } from './guard-compliance.service';
import { CreateGuardComplianceDto } from './dto/create-guard-compliance.dto';
import { UpdateGuardComplianceDto } from './dto/update-guard-compliance.dto';

const complianceFileStorage = diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, ensureGuardComplianceUploadDir());
  },
  filename: (_req, file, callback) => {
    const unique = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    callback(null, `${unique}-${sanitizeFilename(file.originalname)}`);
  },
});

function complianceFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!GUARD_COMPLIANCE_UPLOAD_ALLOWED_EXTENSIONS.test(file.originalname)) {
    callback(
      new BadRequestException(
        `Unsupported file type for "${file.originalname}". Allowed types: PDF, JPG, PNG.`,
      ),
      false,
    );
    return;
  }
  callback(null, true);
}

@Controller('guard-compliance')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('guards.view')
export class GuardComplianceController {
  constructor(
    private readonly guardComplianceService: GuardComplianceService,
  ) {}

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('guard_id') guardId?: string) {
    return this.guardComplianceService.findAllForTenant(user, guardId);
  }

  @Post()
  @RequirePermission('guards.manage')
  create(@GetUser() user: ActiveUser, @Body() dto: CreateGuardComplianceDto) {
    return this.guardComplianceService.create(user, dto);
  }

  @Put(':id')
  @RequirePermission('guards.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateGuardComplianceDto,
  ) {
    return this.guardComplianceService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('guards.manage')
  remove(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.guardComplianceService.remove(user, id);
  }

  @Post(':id/document')
  @RequirePermission('guards.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: complianceFileStorage,
      fileFilter: complianceFileFilter,
      limits: { fileSize: guardComplianceUploadMaxBytes() },
    }),
  )
  uploadDocument(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.guardComplianceService.attachDocument(user, id, file);
  }

  @Get(':id/document')
  async downloadDocument(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, filename } =
      await this.guardComplianceService.getDocumentForDownload(user, id);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  }
}
