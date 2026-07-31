import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
import { EmailService } from '../email/email.service';
import { GenerateRfpDto } from '../ai/dto/generate-rfp.dto';
import {
  GenerateEvaluationDto,
  VendorSubmissionSummaryDto,
} from '../ai/dto/generate-evaluation.dto';
import { CreateRfpDto } from './dto/create-rfp.dto';
import { UpdateRfpDto } from './dto/update-rfp.dto';
import { CreatePerformanceReviewDto } from './dto/create-performance-review.dto';
import { UpdatePerformanceReviewDto } from './dto/update-performance-review.dto';
import { VENDOR_UPLOAD_DIR } from '../common/file-storage.util';

const SUBMISSION_DOCUMENT_LABELS: Record<string, string> = {
  proposalFile: 'Proposal PDF',
  pricingFile: 'Pricing Sheet',
  insuranceFile: 'Insurance Certificate',
  licenseFile: 'Security License',
};
const EVALUATION_EXCERPT_MAX_CHARS = 3000;

const SUBMISSION_FILE_FIELDS = [
  'proposalFile',
  'pricingFile',
  'insuranceFile',
  'licenseFile',
] as const;
type SubmissionFileField = (typeof SUBMISSION_FILE_FIELDS)[number];

@Injectable()
export class RfpService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private auditService: AuditService,
    private brandingService: BrandingService,
    private emailService: EmailService,
  ) {}

  private parseOptionalDate(value: string | undefined, fieldName: string) {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return parsed;
  }

  private normalizeSecurityTypes(value: string[] | undefined) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizePricingItems(value: string[] | undefined) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async findRfpOrThrow(tenantId: string, id: string) {
    const rfp = await this.prisma.rfp.findFirst({ where: { id, tenantId } });

    if (!rfp) {
      throw new NotFoundException('RFP not found');
    }

    return rfp;
  }

  async create(
    tenantId: string,
    userId: string | undefined,
    dto: CreateRfpDto,
  ) {
    const rfp = await this.prisma.rfp.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        clientName: dto.clientName.trim(),
        companyName: dto.companyName?.trim() || null,
        industry: dto.industry?.trim() || null,
        projectName: dto.projectName?.trim() || null,
        dueDate: this.parseOptionalDate(dto.dueDate, 'dueDate'),
        startDate: this.parseOptionalDate(dto.startDate, 'startDate'),
        endDate: this.parseOptionalDate(dto.endDate, 'endDate'),
        estimatedBudget: dto.estimatedBudget ?? null,
        securityTypes: this.normalizeSecurityTypes(dto.securityTypes),
        numberOfLocations: dto.numberOfLocations ?? null,
        address: dto.address?.trim() || null,
        operatingHours: dto.operatingHours?.trim() || null,
        guardsRequired: dto.guardsRequired ?? null,
        pricingModel: dto.pricingModel ?? null,
        requiredPricingItems: this.normalizePricingItems(
          dto.requiredPricingItems,
        ),
        paymentTerms: dto.paymentTerms?.trim() || null,
        pricingValidity: dto.pricingValidity?.trim() || null,
        pricingNotes: dto.pricingNotes?.trim() || null,
        additionalRequirements: dto.additionalRequirements?.trim() || null,
        generatedContent: dto.generatedContent ?? null,
        status: dto.status || 'DRAFT',
        createdBy: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Rfp',
      entityId: rfp.id,
      details: `Created RFP: ${rfp.title}`,
    });

    return rfp;
  }

  private async attachCreators<T extends { createdBy: string | null }>(
    rfps: T[],
  ) {
    const creatorIds = Array.from(
      new Set(
        rfps
          .map((rfp) => rfp.createdBy)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (creatorIds.length === 0) {
      return rfps.map((rfp) => ({
        ...rfp,
        createdByUser: null as {
          id: string;
          name: string | null;
          email: string;
        } | null,
      }));
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, email: true },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return rfps.map((rfp) => ({
      ...rfp,
      createdByUser: rfp.createdBy
        ? (usersById.get(rfp.createdBy) ?? null)
        : null,
    }));
  }

  async findAll(tenantId: string) {
    const rfps = await this.prisma.rfp.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return this.attachCreators(rfps);
  }

  async findOne(tenantId: string, id: string) {
    const rfp = await this.findRfpOrThrow(tenantId, id);
    const [withCreator] = await this.attachCreators([rfp]);
    const evaluation = await this.findLatestEvaluation(tenantId, id);
    const awardedVendor = rfp.awardedVendorId
      ? await this.prisma.vendor.findFirst({
          where: { id: rfp.awardedVendorId, tenantId },
          select: {
            id: true,
            companyName: true,
            contactPerson: true,
            email: true,
          },
        })
      : null;
    return { ...withCreator, evaluation, awardedVendor };
  }

  async update(
    tenantId: string,
    userId: string | undefined,
    id: string,
    dto: UpdateRfpDto,
  ) {
    await this.findRfpOrThrow(tenantId, id);

    const updated = await this.prisma.rfp.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.clientName !== undefined
          ? { clientName: dto.clientName.trim() }
          : {}),
        ...(dto.companyName !== undefined
          ? { companyName: dto.companyName?.trim() || null }
          : {}),
        ...(dto.industry !== undefined
          ? { industry: dto.industry?.trim() || null }
          : {}),
        ...(dto.projectName !== undefined
          ? { projectName: dto.projectName?.trim() || null }
          : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: this.parseOptionalDate(dto.dueDate, 'dueDate') }
          : {}),
        ...(dto.startDate !== undefined
          ? { startDate: this.parseOptionalDate(dto.startDate, 'startDate') }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: this.parseOptionalDate(dto.endDate, 'endDate') }
          : {}),
        ...(dto.estimatedBudget !== undefined
          ? { estimatedBudget: dto.estimatedBudget }
          : {}),
        ...(dto.securityTypes !== undefined
          ? { securityTypes: this.normalizeSecurityTypes(dto.securityTypes) }
          : {}),
        ...(dto.numberOfLocations !== undefined
          ? { numberOfLocations: dto.numberOfLocations }
          : {}),
        ...(dto.address !== undefined
          ? { address: dto.address?.trim() || null }
          : {}),
        ...(dto.operatingHours !== undefined
          ? { operatingHours: dto.operatingHours?.trim() || null }
          : {}),
        ...(dto.guardsRequired !== undefined
          ? { guardsRequired: dto.guardsRequired }
          : {}),
        ...(dto.pricingModel !== undefined
          ? { pricingModel: dto.pricingModel ?? null }
          : {}),
        ...(dto.requiredPricingItems !== undefined
          ? {
              requiredPricingItems: this.normalizePricingItems(
                dto.requiredPricingItems,
              ),
            }
          : {}),
        ...(dto.paymentTerms !== undefined
          ? { paymentTerms: dto.paymentTerms?.trim() || null }
          : {}),
        ...(dto.pricingValidity !== undefined
          ? { pricingValidity: dto.pricingValidity?.trim() || null }
          : {}),
        ...(dto.pricingNotes !== undefined
          ? { pricingNotes: dto.pricingNotes?.trim() || null }
          : {}),
        ...(dto.additionalRequirements !== undefined
          ? {
              additionalRequirements:
                dto.additionalRequirements?.trim() || null,
            }
          : {}),
        ...(dto.generatedContent !== undefined
          ? { generatedContent: dto.generatedContent }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Rfp',
      entityId: id,
      details: `Updated RFP: ${updated.title}`,
    });

    return updated;
  }

  async remove(tenantId: string, userId: string | undefined, id: string) {
    const existing = await this.findRfpOrThrow(tenantId, id);

    await this.prisma.rfp.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Rfp',
      entityId: id,
      details: `Deleted RFP: ${existing.title}`,
    });

    return { success: true };
  }

  async generate(dto: GenerateRfpDto) {
    const content = await this.aiService.generateRfp(dto);
    return { content };
  }

  private stripInlineTags(html: string) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  private renderContentToPdf(doc: any, html: string | null) {
    if (!html?.trim()) {
      doc
        .fontSize(11)
        .fillColor('#6b7280')
        .text('No content has been generated for this RFP yet.');
      return;
    }

    const blockPattern = /<(h1|h2|h3|p|ul|ol)([^>]*)>([\s\S]*?)<\/\1>/gi;
    const listItemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match: RegExpExecArray | null;
    let matchedAny = false;

    while ((match = blockPattern.exec(html)) !== null) {
      matchedAny = true;
      const [, tag, , inner] = match;

      if (tag === 'h1') {
        doc
          .moveDown(0.5)
          .fontSize(18)
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .text(this.stripInlineTags(inner));
      } else if (tag === 'h2') {
        doc
          .moveDown(0.5)
          .fontSize(15)
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .text(this.stripInlineTags(inner));
      } else if (tag === 'h3') {
        doc
          .moveDown(0.4)
          .fontSize(13)
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .text(this.stripInlineTags(inner));
      } else if (tag === 'ul' || tag === 'ol') {
        doc.moveDown(0.2);
        let itemMatch: RegExpExecArray | null;
        let index = 1;
        listItemPattern.lastIndex = 0;
        while ((itemMatch = listItemPattern.exec(inner)) !== null) {
          const prefix = tag === 'ol' ? `${index}.` : '•';
          doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#1f2937')
            .text(`${prefix}  ${this.stripInlineTags(itemMatch[1])}`, {
              indent: 12,
            });
          index += 1;
        }
        doc.moveDown(0.2);
      } else {
        const text = this.stripInlineTags(inner);
        if (text) {
          doc
            .moveDown(0.3)
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#1f2937')
            .text(text, {
              align: 'left',
              lineGap: 3,
            });
        }
      }
    }

    if (!matchedAny) {
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#1f2937')
        .text(this.stripInlineTags(html), {
          align: 'left',
          lineGap: 3,
        });
    }
  }

  async exportPdf(tenantId: string, id: string): Promise<Buffer> {
    const rfp = await this.findRfpOrThrow(tenantId, id);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    const branding = await this.brandingService.brandingSnapshot(tenantId);

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.brandingService.addPdfHeader(doc, rfp.title, branding);
      doc.moveDown();
      doc
        .fontSize(10)
        .fillColor(branding.secondary_color)
        .text(
          `Client: ${rfp.clientName}${rfp.companyName ? ` (${rfp.companyName})` : ''} | Status: ${rfp.status}`,
          { align: 'left' },
        );
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      this.renderContentToPdf(doc, rfp.generatedContent);

      doc.end();
    });
  }

  async findAssignedVendors(tenantId: string, id: string) {
    await this.findRfpOrThrow(tenantId, id);

    const assignments = await this.prisma.rfpVendor.findMany({
      where: { tenantId, rfpId: id },
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    });

    return assignments.map((assignment) => assignment.vendor);
  }

  async assignVendors(
    tenantId: string,
    userId: string | undefined,
    id: string,
    vendorIds: string[],
  ) {
    await this.findRfpOrThrow(tenantId, id);

    const uniqueVendorIds = Array.from(
      new Set(vendorIds.map((vendorId) => vendorId.trim()).filter(Boolean)),
    );

    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: uniqueVendorIds }, tenantId },
      select: { id: true, companyName: true },
    });

    if (vendors.length !== uniqueVendorIds.length) {
      throw new BadRequestException(
        'One or more vendors were not found in this tenant',
      );
    }

    await this.prisma.rfpVendor.createMany({
      data: vendors.map((vendor) => ({
        tenantId,
        rfpId: id,
        vendorId: vendor.id,
      })),
      skipDuplicates: true,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Rfp',
      entityId: id,
      details: `Assigned vendor(s) to RFP: ${vendors.map((vendor) => vendor.companyName).join(', ')}`,
    });

    return this.findAssignedVendors(tenantId, id);
  }

  async removeVendor(
    tenantId: string,
    userId: string | undefined,
    id: string,
    vendorId: string,
  ) {
    const rfp = await this.findRfpOrThrow(tenantId, id);

    if (rfp.awardedVendorId === vendorId) {
      throw new BadRequestException(
        'The awarded vendor cannot be removed from this RFP.',
      );
    }

    const assignment = await this.prisma.rfpVendor.findFirst({
      where: { tenantId, rfpId: id, vendorId },
      include: { vendor: true },
    });

    if (!assignment) {
      throw new NotFoundException('This vendor is not assigned to this RFP');
    }

    await this.prisma.rfpVendor.delete({ where: { id: assignment.id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Rfp',
      entityId: id,
      details: `Removed vendor from RFP: ${assignment.vendor.companyName}`,
    });

    return { success: true };
  }

  async inviteVendors(
    tenantId: string,
    userId: string | undefined,
    id: string,
    vendorIds: string[],
  ) {
    const rfp = await this.findRfpOrThrow(tenantId, id);

    const uniqueVendorIds = Array.from(
      new Set(vendorIds.map((vendorId) => vendorId.trim()).filter(Boolean)),
    );

    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: uniqueVendorIds }, tenantId },
    });

    if (vendors.length !== uniqueVendorIds.length) {
      throw new BadRequestException(
        'One or more vendors were not found in this tenant',
      );
    }

    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const invited: string[] = [];
    const skippedNoEmail: string[] = [];
    const emailFailed: string[] = [];

    for (const vendor of vendors) {
      if (!vendor.email) {
        skippedNoEmail.push(vendor.companyName);
        continue;
      }

      const invitationToken = randomBytes(32).toString('base64url');

      const rfpVendor = await this.prisma.rfpVendor.upsert({
        where: { rfpId_vendorId: { rfpId: id, vendorId: vendor.id } },
        update: {
          invitationToken,
          invitationStatus: 'INVITED',
          invitedAt: new Date(),
        },
        create: {
          tenantId,
          rfpId: id,
          vendorId: vendor.id,
          invitationToken,
          invitationStatus: 'INVITED',
          invitedAt: new Date(),
        },
      });

      invited.push(vendor.companyName);

      try {
        await this.emailService.sendVendorInvitationEmail(tenantId, {
          vendorEmail: vendor.email,
          vendorCompanyName: vendor.companyName,
          rfpTitle: rfp.title,
          dueDate: rfp.dueDate,
          invitationUrl: `${frontendUrl}/vendor/invitation/${rfpVendor.invitationToken}`,
        });
      } catch (error) {
        // The invitation record and secure link already exist regardless of email delivery,
        // so a transport failure here should not fail the whole request (same tolerance
        // already applied to bulk proposal emails elsewhere in this codebase).
        emailFailed.push(vendor.companyName);
        console.error(
          `Failed to send vendor invitation email to ${vendor.email}`,
          error,
        );
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Rfp',
      entityId: id,
      details: `Invited vendor(s) to RFP: ${invited.join(', ') || 'none'}`,
    });

    return { invited, skippedNoEmail, emailFailed };
  }

  async findSubmissions(tenantId: string, id: string) {
    await this.findRfpOrThrow(tenantId, id);

    return this.prisma.rfpVendor.findMany({
      where: { tenantId, rfpId: id },
      include: { vendor: true, submission: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async downloadSubmissionFile(
    tenantId: string,
    id: string,
    vendorId: string,
    field: string,
  ) {
    if (!SUBMISSION_FILE_FIELDS.includes(field as SubmissionFileField)) {
      throw new BadRequestException('Invalid document field');
    }

    await this.findRfpOrThrow(tenantId, id);

    const rfpVendor = await this.prisma.rfpVendor.findFirst({
      where: { tenantId, rfpId: id, vendorId },
      include: { submission: true },
    });

    if (!rfpVendor?.submission) {
      throw new NotFoundException('No submission found for this vendor');
    }

    const storedFilename = rfpVendor.submission[field as SubmissionFileField];
    if (!storedFilename) {
      throw new NotFoundException('This document was not submitted');
    }

    const filePath = join(VENDOR_UPLOAD_DIR, storedFilename);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on server');
    }

    return { stream: createReadStream(filePath), filename: storedFilename };
  }

  private async extractPdfExcerpt(
    storedFilename: string | null,
  ): Promise<string | null> {
    if (!storedFilename || !/\.pdf$/i.test(storedFilename)) return null;

    try {
      const filePath = join(VENDOR_UPLOAD_DIR, storedFilename);
      if (!existsSync(filePath)) return null;

      const buffer = await readFile(filePath);
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer, { pagerender: () => '' });
      const text = String(data.text || '').trim();
      return text ? text.slice(0, EVALUATION_EXCERPT_MAX_CHARS) : null;
    } catch {
      // Best-effort extraction only — a corrupt or unreadable file should never block evaluation generation.
      return null;
    }
  }

  async generateEvaluation(
    tenantId: string,
    userId: string | undefined,
    id: string,
  ) {
    const rfp = await this.findRfpOrThrow(tenantId, id);

    const rfpVendors = await this.prisma.rfpVendor.findMany({
      where: { tenantId, rfpId: id },
      include: { vendor: true, submission: true },
    });

    const submitted = rfpVendors.filter((item) => item.submission);

    if (submitted.length === 0) {
      throw new BadRequestException(
        'At least one vendor must have a submitted proposal before an evaluation can be generated.',
      );
    }

    const vendorSummaries: VendorSubmissionSummaryDto[] = await Promise.all(
      submitted.map(async (item) => {
        const submission = item.submission!;
        const submittedDocuments: string[] = [];
        const missingDocuments: string[] = [];

        for (const field of SUBMISSION_FILE_FIELDS) {
          const label = SUBMISSION_DOCUMENT_LABELS[field];
          if (submission[field]) {
            submittedDocuments.push(label);
          } else {
            missingDocuments.push(label);
          }
        }

        const [proposalExcerpt, pricingExcerpt] = await Promise.all([
          this.extractPdfExcerpt(submission.proposalFile),
          this.extractPdfExcerpt(submission.pricingFile),
        ]);

        return {
          companyName: item.vendor.companyName,
          contactPerson: item.vendor.contactPerson,
          servicesOffered: Array.isArray(item.vendor.services)
            ? (item.vendor.services as string[])
            : [],
          submittedDocuments,
          missingDocuments,
          notes: submission.notes,
          proposalExcerpt,
          pricingExcerpt,
          submittedAt: item.submittedAt ? item.submittedAt.toISOString() : null,
        };
      }),
    );

    const evaluationDto: GenerateEvaluationDto = {
      rfpTitle: rfp.title,
      clientName: rfp.clientName,
      industry: rfp.industry,
      securityTypes: Array.isArray(rfp.securityTypes)
        ? (rfp.securityTypes as string[])
        : [],
      numberOfLocations: rfp.numberOfLocations,
      guardsRequired: rfp.guardsRequired,
      estimatedBudget: rfp.estimatedBudget,
      additionalRequirements: rfp.additionalRequirements,
      vendors: vendorSummaries,
    };

    const result = await this.aiService.generateEvaluationReport(evaluationDto);

    const evaluation = await this.prisma.evaluationReport.create({
      data: {
        tenantId,
        rfpId: id,
        summary: result.summary,
        recommendedVendor: result.recommendedVendor,
        overallAnalysis: result.overallAnalysis,
        generatedReport: result.fullReportMarkdown,
      },
    });

    // Advance the RFP to EVALUATED as part of the DRAFT -> GENERATED -> FINALIZED -> EVALUATED -> AWARDED
    // workflow, unless it has already been awarded (a re-run evaluation should not regress an awarded RFP).
    if (rfp.status !== 'AWARDED') {
      await this.prisma.rfp.update({
        where: { id },
        data: { status: 'EVALUATED' },
      });
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GENERATE',
      entityType: 'EvaluationReport',
      entityId: evaluation.id,
      details: `Generated AI Evaluation for RFP: ${rfp.title}`,
    });

    return evaluation;
  }

  async findLatestEvaluation(tenantId: string, id: string) {
    return this.prisma.evaluationReport.findFirst({
      where: { tenantId, rfpId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  private getRejectedVendorIds(rfp: { rejectedVendorIds: unknown }): string[] {
    return Array.isArray(rfp.rejectedVendorIds)
      ? (rfp.rejectedVendorIds as string[])
      : [];
  }

  async awardContract(
    tenantId: string,
    userId: string | undefined,
    id: string,
    vendorId: string,
    awardNotes: string | undefined,
  ) {
    const rfp = await this.findRfpOrThrow(tenantId, id);

    if (rfp.awardedVendorId) {
      throw new BadRequestException('This RFP has already been awarded.');
    }

    const evaluation = await this.findLatestEvaluation(tenantId, id);
    if (!evaluation) {
      throw new BadRequestException(
        'An AI evaluation must be generated before a contract can be awarded.',
      );
    }

    if (this.getRejectedVendorIds(rfp).includes(vendorId)) {
      throw new BadRequestException(
        'This vendor has already been rejected and cannot be awarded the contract.',
      );
    }

    const rfpVendor = await this.prisma.rfpVendor.findFirst({
      where: { tenantId, rfpId: id, vendorId },
      include: { vendor: true, submission: true },
    });

    if (!rfpVendor) {
      throw new NotFoundException('This vendor is not assigned to this RFP.');
    }

    if (!rfpVendor.submission) {
      throw new BadRequestException(
        'This vendor has not submitted a proposal and cannot be awarded the contract.',
      );
    }

    // Atomic conditional update: only succeeds if the RFP is still un-awarded at the moment of writing,
    // closing the check-then-act race window between the read above and this write (two concurrent
    // award requests can no longer both succeed).
    const awardResult = await this.prisma.rfp.updateMany({
      where: { id, tenantId, awardedVendorId: null },
      data: {
        awardedVendorId: vendorId,
        awardDate: new Date(),
        awardNotes: awardNotes?.trim() || null,
        status: 'AWARDED',
      },
    });

    if (awardResult.count === 0) {
      throw new BadRequestException('This RFP has already been awarded.');
    }

    const updated = await this.findRfpOrThrow(tenantId, id);

    if (rfpVendor.vendor.email) {
      try {
        await this.emailService.sendContractAwardEmail(tenantId, {
          vendorEmail: rfpVendor.vendor.email,
          vendorCompanyName: rfpVendor.vendor.companyName,
          rfpTitle: rfp.title,
          awardNotes: updated.awardNotes,
        });
      } catch (error) {
        // Award state is already persisted; email delivery is best-effort (same tolerance as vendor invitations).
        console.error(
          `Failed to send contract award email to ${rfpVendor.vendor.email}`,
          error,
        );
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CONTRACT_AWARDED',
      entityType: 'Rfp',
      entityId: id,
      details: `Contract Awarded to vendor: ${rfpVendor.vendor.companyName}`,
    });

    return updated;
  }

  async rejectVendor(
    tenantId: string,
    userId: string | undefined,
    id: string,
    vendorId: string,
    reason: string | undefined,
  ) {
    const rfp = await this.findRfpOrThrow(tenantId, id);

    if (rfp.awardedVendorId === vendorId) {
      throw new BadRequestException(
        'This vendor has already been awarded the contract and cannot be rejected.',
      );
    }

    const rfpVendor = await this.prisma.rfpVendor.findFirst({
      where: { tenantId, rfpId: id, vendorId },
      include: { vendor: true },
    });

    if (!rfpVendor) {
      throw new NotFoundException('This vendor is not assigned to this RFP.');
    }

    const rejectedVendorIds = this.getRejectedVendorIds(rfp);
    if (!rejectedVendorIds.includes(vendorId)) {
      rejectedVendorIds.push(vendorId);
      await this.prisma.rfp.update({
        where: { id },
        data: { rejectedVendorIds },
      });
    }

    if (rfpVendor.vendor.email) {
      try {
        await this.emailService.sendVendorRejectionEmail(tenantId, {
          vendorEmail: rfpVendor.vendor.email,
          vendorCompanyName: rfpVendor.vendor.companyName,
          rfpTitle: rfp.title,
          reason,
        });
      } catch (error) {
        console.error(
          `Failed to send vendor rejection email to ${rfpVendor.vendor.email}`,
          error,
        );
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'VENDOR_REJECTED',
      entityType: 'Rfp',
      entityId: id,
      details: `Vendor Rejected: ${rfpVendor.vendor.companyName}${reason ? ` (${reason})` : ''}`,
    });

    return { success: true, rejectedVendorIds };
  }

  async findPerformanceReviews(tenantId: string, id: string) {
    await this.findRfpOrThrow(tenantId, id);

    return this.prisma.vendorPerformance.findMany({
      where: { tenantId, rfpId: id },
      orderBy: { reviewDate: 'desc' },
    });
  }

  async createPerformanceReview(
    tenantId: string,
    userId: string | undefined,
    id: string,
    dto: CreatePerformanceReviewDto,
  ) {
    const rfp = await this.findRfpOrThrow(tenantId, id);

    if (rfp.status !== 'AWARDED' || !rfp.awardedVendorId) {
      throw new BadRequestException(
        'A performance review can only be added once this RFP has an awarded vendor.',
      );
    }

    const review = await this.prisma.vendorPerformance.create({
      data: {
        tenantId,
        rfpId: id,
        vendorId: rfp.awardedVendorId,
        reviewDate:
          this.parseOptionalDate(dto.reviewDate, 'reviewDate') ?? new Date(),
        overallRating: dto.overallRating,
        slaCompliance: dto.slaCompliance,
        incidentCount: dto.incidentCount,
        responseTime: dto.responseTime,
        notes: dto.notes?.trim() || null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'PERFORMANCE_REVIEW_ADDED',
      entityType: 'VendorPerformance',
      entityId: review.id,
      details: `Performance Review Added for RFP: ${rfp.title}`,
    });

    return review;
  }

  async updatePerformanceReview(
    tenantId: string,
    userId: string | undefined,
    reviewId: string,
    dto: UpdatePerformanceReviewDto,
  ) {
    const existing = await this.prisma.vendorPerformance.findFirst({
      where: { id: reviewId, tenantId },
      include: { rfp: { select: { title: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Performance review not found');
    }

    const updated = await this.prisma.vendorPerformance.update({
      where: { id: reviewId },
      data: {
        ...(dto.reviewDate !== undefined
          ? {
              reviewDate:
                this.parseOptionalDate(dto.reviewDate, 'reviewDate') ??
                existing.reviewDate,
            }
          : {}),
        ...(dto.overallRating !== undefined
          ? { overallRating: dto.overallRating }
          : {}),
        ...(dto.slaCompliance !== undefined
          ? { slaCompliance: dto.slaCompliance }
          : {}),
        ...(dto.incidentCount !== undefined
          ? { incidentCount: dto.incidentCount }
          : {}),
        ...(dto.responseTime !== undefined
          ? { responseTime: dto.responseTime }
          : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'PERFORMANCE_REVIEW_UPDATED',
      entityType: 'VendorPerformance',
      entityId: reviewId,
      details: `Performance Review Updated for RFP: ${existing.rfp.title}`,
    });

    return updated;
  }
}
