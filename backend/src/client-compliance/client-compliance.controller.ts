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
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import {
  CLIENT_INSURANCE_UPLOAD_ALLOWED_EXTENSIONS,
  clientInsuranceUploadMaxBytes,
  ensureClientInsuranceUploadDir,
  sanitizeFilename,
} from '../common/file-storage.util';
import { ClientComplianceService } from './client-compliance.service';
import { CreateClientInsurancePolicyDto } from './dto/create-client-insurance-policy.dto';
import { UpdateClientInsurancePolicyDto } from './dto/update-client-insurance-policy.dto';

const insuranceFileStorage = diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, ensureClientInsuranceUploadDir());
  },
  filename: (_req, file, callback) => {
    const unique = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    callback(null, `${unique}-${sanitizeFilename(file.originalname)}`);
  },
});

function insuranceFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  // Fast extension reject; the service additionally verifies the MIME type
  // and the size cap once the file is on disk.
  if (!CLIENT_INSURANCE_UPLOAD_ALLOWED_EXTENSIONS.test(file.originalname)) {
    callback(
      new BadRequestException(
        `Unsupported file type for "${file.originalname}". Allowed: PDF, JPG, PNG, WEBP.`,
      ),
      false,
    );
    return;
  }
  callback(null, true);
}

// Admin-facing. Reads use 'clients.view' (broadened to finance/invoice roles
// for the advisory summary only); all mutations require 'clients.manage' -
// the same view/manage split the audit recommends and that ClientsController
// itself already uses.
@Controller('client-compliance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientComplianceController {
  constructor(
    private readonly clientComplianceService: ClientComplianceService,
  ) {}

  @Get()
  @RequirePermission('clients.view')
  findAll(
    @GetUser() user: ActiveUser,
    @Query('client_id') clientId?: string,
    @Query('site_id') siteId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.clientComplianceService.findAll(user, {
      clientId: clientId?.trim() || undefined,
      siteId: siteId?.trim() || undefined,
      status: status?.trim() || undefined,
      type: type?.trim() || undefined,
    });
  }

  // Read-only advisory counts for the Finance / Clients / invoice-generation
  // screens. Deliberately broader than 'clients.view' so a finance-only or
  // invoice-preparer user still sees the advisory - it exposes only aggregate
  // numbers, never policy detail or documents.
  @Get('summary')
  @RequireAnyPermission('clients.view', 'finance.view', 'invoices.generate')
  getSummary(
    @GetUser() user: ActiveUser,
    @Query('client_id') clientId?: string,
  ) {
    return this.clientComplianceService.getSummary(
      user,
      clientId?.trim() || undefined,
    );
  }

  @Post()
  @RequirePermission('clients.manage')
  create(
    @GetUser() user: ActiveUser,
    @Body() dto: CreateClientInsurancePolicyDto,
  ) {
    return this.clientComplianceService.create(user, dto);
  }

  @Put(':id')
  @RequirePermission('clients.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientInsurancePolicyDto,
  ) {
    return this.clientComplianceService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('clients.manage')
  remove(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.clientComplianceService.remove(user, id);
  }

  @Post(':id/document')
  @RequirePermission('clients.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: insuranceFileStorage,
      fileFilter: insuranceFileFilter,
      limits: { fileSize: clientInsuranceUploadMaxBytes() },
    }),
  )
  uploadDocument(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.clientComplianceService.attachDocument(user, id, file);
  }

  @Get(':id/document')
  @RequirePermission('clients.view')
  async downloadDocument(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, filename } =
      await this.clientComplianceService.getDocumentForDownload(user, id);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'private, no-store',
    });
    stream.pipe(res);
  }
}
