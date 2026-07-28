import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { VENDOR_UPLOAD_DIR } from '../common/file-storage.util';

export interface SubmissionFiles {
  proposalFile?: Express.Multer.File[];
  pricingFile?: Express.Multer.File[];
  insuranceFile?: Express.Multer.File[];
  licenseFile?: Express.Multer.File[];
}

@Injectable()
export class VendorPortalService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async findByTokenOrThrow(token: string) {
    const rfpVendor = await this.prisma.rfpVendor.findUnique({
      where: { invitationToken: token },
      include: { vendor: true, rfp: true, submission: true },
    });

    if (!rfpVendor) {
      throw new NotFoundException('This invitation link is invalid.');
    }

    return rfpVendor;
  }

  private isExpired(dueDate: Date | null) {
    return Boolean(dueDate && dueDate.getTime() < Date.now());
  }

  async getInvitation(token: string) {
    const rfpVendor = await this.findByTokenOrThrow(token);

    if (this.isExpired(rfpVendor.rfp.dueDate)) {
      throw new GoneException('This invitation link has expired.');
    }

    return {
      companyName: rfpVendor.vendor.companyName,
      rfpTitle: rfpVendor.rfp.title,
      industry: rfpVendor.rfp.industry,
      dueDate: rfpVendor.rfp.dueDate,
      additionalRequirements: rfpVendor.rfp.additionalRequirements,
      securityTypes: rfpVendor.rfp.securityTypes,
      invitationStatus: rfpVendor.invitationStatus,
      alreadySubmitted: rfpVendor.invitationStatus === 'SUBMITTED',
    };
  }

  async markViewed(token: string) {
    const rfpVendor = await this.findByTokenOrThrow(token);

    if (this.isExpired(rfpVendor.rfp.dueDate)) {
      throw new GoneException('This invitation link has expired.');
    }

    if (
      rfpVendor.invitationStatus === 'PENDING' ||
      rfpVendor.invitationStatus === 'INVITED'
    ) {
      await this.prisma.rfpVendor.update({
        where: { id: rfpVendor.id },
        data: {
          invitationStatus: 'VIEWED',
          viewedAt: rfpVendor.viewedAt ?? new Date(),
        },
      });
    }

    return { success: true };
  }

  async submitProposal(
    token: string,
    files: SubmissionFiles,
    notes: string | undefined,
  ) {
    const rfpVendor = await this.findByTokenOrThrow(token);

    if (this.isExpired(rfpVendor.rfp.dueDate)) {
      await this.cleanupUploadedFiles(files);
      throw new GoneException('This invitation link has expired.');
    }

    if (rfpVendor.invitationStatus === 'SUBMITTED' || rfpVendor.submission) {
      await this.cleanupUploadedFiles(files);
      throw new ConflictException(
        'A proposal has already been submitted for this invitation.',
      );
    }

    if (!files.proposalFile?.[0]) {
      await this.cleanupUploadedFiles(files);
      throw new BadRequestException(
        'A proposal document is required to submit.',
      );
    }

    const submission = await this.prisma.proposalSubmission.create({
      data: {
        tenantId: rfpVendor.tenantId,
        rfpVendorId: rfpVendor.id,
        proposalFile: files.proposalFile?.[0]?.filename ?? null,
        pricingFile: files.pricingFile?.[0]?.filename ?? null,
        insuranceFile: files.insuranceFile?.[0]?.filename ?? null,
        licenseFile: files.licenseFile?.[0]?.filename ?? null,
        notes: notes?.trim() || null,
      },
    });

    await this.prisma.rfpVendor.update({
      where: { id: rfpVendor.id },
      data: {
        invitationStatus: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: rfpVendor.tenantId,
      action: 'CREATE',
      entityType: 'ProposalSubmission',
      entityId: submission.id,
      details: `Vendor "${rfpVendor.vendor.companyName}" submitted a proposal for RFP "${rfpVendor.rfp.title}"`,
    });

    return { success: true };
  }

  private async cleanupUploadedFiles(files: SubmissionFiles) {
    const all = [
      ...(files.proposalFile ?? []),
      ...(files.pricingFile ?? []),
      ...(files.insuranceFile ?? []),
      ...(files.licenseFile ?? []),
    ];

    await Promise.all(
      all.map((file) =>
        unlink(join(VENDOR_UPLOAD_DIR, file.filename)).catch(() => undefined),
      ),
    );
  }
}
