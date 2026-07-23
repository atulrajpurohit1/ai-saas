import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
import { GenerateRfpDto } from '../ai/dto/generate-rfp.dto';
import { CreateRfpDto } from './dto/create-rfp.dto';
import { UpdateRfpDto } from './dto/update-rfp.dto';

@Injectable()
export class RfpService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private auditService: AuditService,
    private brandingService: BrandingService,
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

  async findRfpOrThrow(tenantId: string, id: string) {
    const rfp = await this.prisma.rfp.findFirst({ where: { id, tenantId } });

    if (!rfp) {
      throw new NotFoundException('RFP not found');
    }

    return rfp;
  }

  async create(tenantId: string, userId: string | undefined, dto: CreateRfpDto) {
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

  private async attachCreators<T extends { createdBy: string | null }>(rfps: T[]) {
    const creatorIds = Array.from(
      new Set(rfps.map((rfp) => rfp.createdBy).filter((id): id is string => Boolean(id))),
    );

    if (creatorIds.length === 0) {
      return rfps.map((rfp) => ({ ...rfp, createdByUser: null as { id: string; name: string | null; email: string } | null }));
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, email: true },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return rfps.map((rfp) => ({
      ...rfp,
      createdByUser: rfp.createdBy ? usersById.get(rfp.createdBy) ?? null : null,
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
    return withCreator;
  }

  async update(tenantId: string, userId: string | undefined, id: string, dto: UpdateRfpDto) {
    await this.findRfpOrThrow(tenantId, id);

    const updated = await this.prisma.rfp.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.clientName !== undefined ? { clientName: dto.clientName.trim() } : {}),
        ...(dto.companyName !== undefined ? { companyName: dto.companyName?.trim() || null } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry?.trim() || null } : {}),
        ...(dto.projectName !== undefined ? { projectName: dto.projectName?.trim() || null } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: this.parseOptionalDate(dto.dueDate, 'dueDate') } : {}),
        ...(dto.startDate !== undefined ? { startDate: this.parseOptionalDate(dto.startDate, 'startDate') } : {}),
        ...(dto.endDate !== undefined ? { endDate: this.parseOptionalDate(dto.endDate, 'endDate') } : {}),
        ...(dto.estimatedBudget !== undefined ? { estimatedBudget: dto.estimatedBudget } : {}),
        ...(dto.securityTypes !== undefined
          ? { securityTypes: this.normalizeSecurityTypes(dto.securityTypes) }
          : {}),
        ...(dto.numberOfLocations !== undefined ? { numberOfLocations: dto.numberOfLocations } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.operatingHours !== undefined ? { operatingHours: dto.operatingHours?.trim() || null } : {}),
        ...(dto.guardsRequired !== undefined ? { guardsRequired: dto.guardsRequired } : {}),
        ...(dto.additionalRequirements !== undefined
          ? { additionalRequirements: dto.additionalRequirements?.trim() || null }
          : {}),
        ...(dto.generatedContent !== undefined ? { generatedContent: dto.generatedContent } : {}),
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
      doc.fontSize(11).fillColor('#6b7280').text('No content has been generated for this RFP yet.');
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
        doc.moveDown(0.5).fontSize(18).fillColor('#111827').font('Helvetica-Bold').text(this.stripInlineTags(inner));
      } else if (tag === 'h2') {
        doc.moveDown(0.5).fontSize(15).fillColor('#111827').font('Helvetica-Bold').text(this.stripInlineTags(inner));
      } else if (tag === 'h3') {
        doc.moveDown(0.4).fontSize(13).fillColor('#111827').font('Helvetica-Bold').text(this.stripInlineTags(inner));
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
            .text(`${prefix}  ${this.stripInlineTags(itemMatch[1])}`, { indent: 12 });
          index += 1;
        }
        doc.moveDown(0.2);
      } else {
        const text = this.stripInlineTags(inner);
        if (text) {
          doc.moveDown(0.3).fontSize(11).font('Helvetica').fillColor('#1f2937').text(text, {
            align: 'left',
            lineGap: 3,
          });
        }
      }
    }

    if (!matchedAny) {
      doc.fontSize(11).font('Helvetica').fillColor('#1f2937').text(this.stripInlineTags(html), {
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
}
