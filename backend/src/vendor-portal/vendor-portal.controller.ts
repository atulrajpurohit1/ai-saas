import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import {
  VENDOR_UPLOAD_ALLOWED_EXTENSIONS,
  ensureVendorUploadDir,
  sanitizeFilename,
  vendorUploadMaxBytes,
} from '../common/file-storage.util';
import { SubmitProposalDto } from './dto/submit-proposal.dto';
import { VendorPortalService, SubmissionFiles } from './vendor-portal.service';

const submissionFileStorage = diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, ensureVendorUploadDir());
  },
  filename: (_req, file, callback) => {
    const unique = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    callback(null, `${unique}-${sanitizeFilename(file.originalname)}`);
  },
});

function submissionFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!VENDOR_UPLOAD_ALLOWED_EXTENSIONS.test(file.originalname)) {
    callback(
      new BadRequestException(
        `Unsupported file type for "${file.originalname}". Allowed types: PDF, DOCX, XLSX, ZIP.`,
      ),
      false,
    );
    return;
  }
  callback(null, true);
}

/** Fully public — vendors reach this via a secure emailed token link, with no admin login. */
@Controller('vendor/invitation')
export class VendorPortalController {
  constructor(private readonly vendorPortalService: VendorPortalService) {}

  @Get(':token')
  getInvitation(@Param('token') token: string) {
    return this.vendorPortalService.getInvitation(token);
  }

  @Post(':token/view')
  markViewed(@Param('token') token: string) {
    return this.vendorPortalService.markViewed(token);
  }

  @Post(':token/submit')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'proposalFile', maxCount: 1 },
        { name: 'pricingFile', maxCount: 1 },
        { name: 'insuranceFile', maxCount: 1 },
        { name: 'licenseFile', maxCount: 1 },
      ],
      {
        storage: submissionFileStorage,
        fileFilter: submissionFileFilter,
        limits: { fileSize: vendorUploadMaxBytes() },
      },
    ),
  )
  submitProposal(
    @Param('token') token: string,
    @UploadedFiles() files: SubmissionFiles,
    @Body() dto: SubmitProposalDto,
  ) {
    return this.vendorPortalService.submitProposal(
      token,
      files ?? {},
      dto.notes,
    );
  }
}
