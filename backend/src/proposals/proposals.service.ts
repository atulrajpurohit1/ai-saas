import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { AiService, LeadProposalPricing } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
import { AiMeteringService } from '../billing/ai-metering.service';
import { AiFeature } from '@prisma/client';

/** App-wide display date format: DD-MM-YYYY (e.g. 25-10-2026). */
function formatDateDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

@Injectable()
export class ProposalsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private auditService: AuditService,
    private brandingService: BrandingService,
    private aiMetering: AiMeteringService,
  ) {}

  private async ensureLeadBelongsToTenant(tenantId: string, leadId?: string) {
    if (!leadId) return;

    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      select: { id: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found in this tenant');
    }
  }

  private async ensureDealBelongsToTenant(tenantId: string, dealId?: string) {
    if (!dealId) return;

    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      select: { id: true },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found in this tenant');
    }
  }

  private async ensureClientBelongsToTenant(
    tenantId: string,
    clientId?: string,
  ) {
    if (clientId === undefined || clientId === null) return;

    if (!clientId.trim()) {
      throw new BadRequestException('Client ID is required');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found in this tenant');
    }
  }

  private async buildPdfBuffer(proposal: {
    tenantId: string;
    title: string;
    content: string;
  }): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    const branding = await this.brandingService.brandingSnapshot(
      proposal.tenantId,
    );

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.brandingService.addPdfHeader(doc, proposal.title, branding);
      doc.moveDown(0.5);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(branding.secondary_color)
        .text(`Generated on: ${formatDateDDMMYYYY(new Date())}`, {
          align: 'right',
        });
      doc.moveDown(0.75);

      // Render the proposal's Markdown as formatted PDF content (headings,
      // bold, lists, tables) instead of printing the raw Markdown source.
      this.brandingService.renderMarkdownBody(doc, proposal.content, {
        primary: branding.primary_color,
      });

      doc.end();
    });
  }

  async create(
    tenantId: string,
    createProposalDto: CreateProposalDto,
    userId?: string,
  ) {
    await this.ensureLeadBelongsToTenant(tenantId, createProposalDto.leadId);
    await this.ensureDealBelongsToTenant(tenantId, createProposalDto.dealId);
    await this.ensureClientBelongsToTenant(
      tenantId,
      createProposalDto.clientId,
    );

    const proposal = await this.prisma.proposal.create({
      data: {
        ...createProposalDto,
        tenantId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Proposal',
      entityId: proposal.id,
      details: `Created proposal: ${proposal.title}`,
    });

    // Create initial version
    await this.prisma.proposalVersion.create({
      data: {
        proposalId: proposal.id,
        content: proposal.content,
        versionNumber: 1,
      },
    });

    return proposal;
  }

  async findAll(tenantId: string) {
    return this.prisma.proposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        lead: true,
        deal: true,
        client: true,
        _count: { select: { versions: true } },
      },
    });
  }

  async findOne(tenantId: string, id: string, clientId?: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: {
        id,
        tenantId,
        ...(clientId ? { clientId } : {}),
      },
      include: {
        lead: true,
        deal: true,
        client: true,
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal with ID ${id} not found`);
    }

    return proposal;
  }

  async update(
    tenantId: string,
    id: string,
    updateProposalDto: UpdateProposalDto,
    userId?: string,
  ) {
    await this.ensureLeadBelongsToTenant(tenantId, updateProposalDto.leadId);
    await this.ensureDealBelongsToTenant(tenantId, updateProposalDto.dealId);
    await this.ensureClientBelongsToTenant(
      tenantId,
      updateProposalDto.clientId,
    );

    const existing = await this.findOne(tenantId, id);

    const updated = await this.prisma.proposal.update({
      where: { id },
      data: updateProposalDto,
    });

    // Handle versioning if content changed
    if (
      updateProposalDto.content &&
      updateProposalDto.content !== existing.content
    ) {
      const nextVersion = existing.versions.length + 1;
      await this.prisma.proposalVersion.create({
        data: {
          proposalId: id,
          content: updateProposalDto.content,
          versionNumber: nextVersion,
        },
      });
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Proposal',
      entityId: id,
    });

    return updated;
  }

  async duplicate(tenantId: string, id: string, userId?: string) {
    const existing = await this.findOne(tenantId, id);

    const proposal = await this.prisma.proposal.create({
      data: {
        title: `${existing.title} (Copy)`,
        content: existing.content,
        status: 'draft',
        tenantId,
        leadId: existing.leadId,
        dealId: existing.dealId,
      },
    });

    await this.prisma.proposalVersion.create({
      data: {
        proposalId: proposal.id,
        content: proposal.content,
        versionNumber: 1,
      },
    });

    return proposal;
  }

  async export(
    tenantId: string,
    id: string,
    userId?: string,
    clientId?: string,
  ): Promise<Buffer> {
    const proposal = await this.findOne(tenantId, id, clientId);
    return this.buildPdfBuffer(proposal);
  }

  // A lead has no client of its own, so the rate card that should price its
  // proposal is the one for whichever client its deals point at. Precedence
  // matches Sales Accelerator's pricing insight: a client-specific card first,
  // then any active tenant card as a benchmark, then nothing -- so the same
  // lead reads the same price in both places.
  private async pricingForLead(
    tenantId: string,
    lead: { deals?: { clientId?: string | null }[] },
    clientId?: string,
  ): Promise<LeadProposalPricing | null> {
    const now = new Date();
    const baseWhere = {
      tenantId,
      status: 'active',
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    };
    const select = {
      roleName: true,
      hourlyRate: true,
      overtimeRate: true,
      holidayRate: true,
    };

    // An explicitly passed client wins over one inferred from the deals.
    const dealClientId =
      lead.deals?.find((deal) => deal.clientId)?.clientId ?? null;
    const targetClientId = clientId ?? dealClientId;

    let rateCards = targetClientId
      ? await this.prisma.rateCard.findMany({
          where: { ...baseWhere, clientId: targetClientId },
          orderBy: { effectiveFrom: 'desc' },
          take: 12,
          select,
        })
      : [];
    let benchmarkSource: LeadProposalPricing['benchmarkSource'] =
      rateCards.length > 0 ? 'client_rate_card' : 'none';

    if (rateCards.length === 0) {
      rateCards = await this.prisma.rateCard.findMany({
        where: baseWhere,
        orderBy: { effectiveFrom: 'desc' },
        take: 20,
        select,
      });
      benchmarkSource = rateCards.length > 0 ? 'tenant_benchmark' : 'none';
    }

    if (rateCards.length === 0) {
      return null;
    }

    const round = (value: number) => Math.round(value * 100) / 100;
    const average = (values: number[]) =>
      values.length
        ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : null;
    const defined = (values: (number | null)[]) =>
      values.filter((value): value is number => typeof value === 'number');

    const hourlyRates = rateCards.map((card) => card.hourlyRate);

    return {
      benchmarkSource,
      rateCardCount: rateCards.length,
      averageHourlyRate: average(hourlyRates),
      minHourlyRate: round(Math.min(...hourlyRates)),
      maxHourlyRate: round(Math.max(...hourlyRates)),
      averageOvertimeRate: average(
        defined(rateCards.map((card) => card.overtimeRate)),
      ),
      averageHolidayRate: average(
        defined(rateCards.map((card) => card.holidayRate)),
      ),
      roles: rateCards
        .filter((card) => card.roleName)
        .slice(0, 8)
        .map((card) => ({
          roleName: card.roleName as string,
          hourlyRate: card.hourlyRate,
          overtimeRate: card.overtimeRate,
          holidayRate: card.holidayRate,
        })),
    };
  }

  async generateForLead(
    tenantId: string,
    leadId: string,
    userId?: string,
    clientId?: string,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      include: { notes: true, deals: true },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    await this.ensureClientBelongsToTenant(tenantId, clientId);

    const pricing = await this.pricingForLead(tenantId, lead, clientId);

    // The issuing agency's own identity, so the generated proposal reads as
    // coming from them rather than leaving "[Your Company Name]" style blanks
    // the AI has no way to fill on its own.
    const branding = await this.brandingService.brandingSnapshot(tenantId);
    const author = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        })
      : null;
    const issuer = {
      companyName: branding.company_name,
      representativeName: author?.name || branding.company_name,
    };

    const content = await this.aiMetering.run(
      { tenantId, userId, feature: AiFeature.LEAD_GENERATION },
      () => this.aiService.generateForLead(lead, pricing, issuer),
    );

    // Deterministic safety net: whatever the model (or the offline fallback)
    // emitted, replace any remaining identity placeholders with real values so
    // a client never receives a proposal still addressed from "[Your Name]".
    const filledContent = this.fillIdentityPlaceholders(content, {
      companyName: issuer.companyName,
      representativeName: issuer.representativeName,
      representativeTitle: 'Authorized Representative',
      clientCompany: lead.company,
    });

    return this.create(
      tenantId,
      {
        title: `Security Services Proposal - ${lead.company}`,
        content: filledContent,
        status: 'draft',
        leadId,
        clientId,
      },
      userId,
    );
  }

  /**
   * Replaces the bracketed identity placeholders the AI leaves in a generated
   * proposal (it is told who the lead is, but never who the issuing agency is)
   * with the real issuer/client values. Case-insensitive and tolerant of extra
   * spacing. Only substitutes well-known identity tokens — any other bracketed
   * placeholder (e.g. "[bracketed rate]") is left intact for the admin to fill.
   */
  private fillIdentityPlaceholders(
    content: string,
    ctx: {
      companyName: string;
      representativeName: string;
      representativeTitle: string;
      clientCompany?: string | null;
    },
  ): string {
    if (!content) return content;

    const replacements: Array<[RegExp, string]> = [
      [/\[\s*Your Company Name\s*\]/gi, ctx.companyName],
      [/\[\s*Company Name\s*\]/gi, ctx.companyName],
      [/\[\s*Your Company\s*\]/gi, ctx.companyName],
      [
        /\[\s*Your Name\s*\/\s*Your Company Representative\s*\]/gi,
        ctx.representativeName,
      ],
      [/\[\s*Your Name\s*\]/gi, ctx.representativeName],
      [/\[\s*Your Company Representative\s*\]/gi, ctx.representativeName],
      [/\[\s*Representative Name\s*\]/gi, ctx.representativeName],
      [/\[\s*Your Title\s*\]/gi, ctx.representativeTitle],
      [/\[\s*Title\s*\]/gi, ctx.representativeTitle],
      [/\[\s*Date\s*\]/gi, formatDateDDMMYYYY(new Date())],
      [/\[\s*Today'?s Date\s*\]/gi, formatDateDDMMYYYY(new Date())],
    ];

    if (ctx.clientCompany) {
      replacements.push(
        [/\[\s*Client Company Name\s*\]/gi, ctx.clientCompany],
        [/\[\s*Client Name\s*\]/gi, ctx.clientCompany],
        [/\[\s*Client\s*\]/gi, ctx.clientCompany],
      );
    }

    return replacements.reduce(
      (text, [pattern, value]) => text.replace(pattern, value),
      content,
    );
  }

  async getComments(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.proposalComment.findMany({
      where: { proposalId: id, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(
    tenantId: string,
    id: string,
    userId: string,
    content: string,
  ) {
    const trimmedContent = content?.trim();

    if (!trimmedContent) {
      throw new BadRequestException('Comment content is required');
    }

    await this.findOne(tenantId, id);

    const comment = await this.prisma.proposalComment.create({
      data: {
        content: trimmedContent,
        proposalId: id,
        userId,
        tenantId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'COMMENT_ADDED',
      entityType: 'Proposal',
      entityId: id,
      details: 'Admin added a comment to proposal',
    });

    return comment;
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const proposal = await this.findOne(tenantId, id);

    await this.prisma.$transaction([
      this.prisma.proposalComment.deleteMany({ where: { proposalId: id } }),
      this.prisma.proposalVersion.deleteMany({ where: { proposalId: id } }),
      this.prisma.proposal.delete({ where: { id } }),
    ]);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Proposal',
      entityId: id,
      details: `Deleted proposal: ${proposal.title}`,
    });

    return { success: true };
  }

  async logAction(
    tenantId: string,
    userId: string,
    entityId: string,
    action: string,
    details?: string,
  ) {
    await this.auditService.log({
      tenantId,
      userId,
      action,
      entityType: 'Proposal',
      entityId,
      details,
    });
  }
}
