import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProposalsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private auditService: AuditService,
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

  private async ensureClientBelongsToTenant(tenantId: string, clientId?: string) {
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

  private async buildPdfBuffer(
    proposal: { title: string; content: string },
  ): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(25).text(proposal.title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, {
        align: 'right',
      });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(14).text(proposal.content, {
        align: 'justify',
        lineGap: 5,
      });

      doc.end();
    });
  }

  async create(tenantId: string, createProposalDto: CreateProposalDto, userId?: string) {
    await this.ensureLeadBelongsToTenant(tenantId, createProposalDto.leadId);
    await this.ensureDealBelongsToTenant(tenantId, createProposalDto.dealId);
    await this.ensureClientBelongsToTenant(tenantId, createProposalDto.clientId);

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
        _count: { select: { versions: true } }
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
    await this.ensureClientBelongsToTenant(tenantId, updateProposalDto.clientId);

    const existing = await this.findOne(tenantId, id);

    const updated = await this.prisma.proposal.update({
      where: { id },
      data: updateProposalDto,
    });

    // Handle versioning if content changed
    if (updateProposalDto.content && updateProposalDto.content !== existing.content) {
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

  async export(tenantId: string, id: string, userId?: string, clientId?: string): Promise<Buffer> {
    const proposal = await this.findOne(tenantId, id, clientId);
    return this.buildPdfBuffer(proposal);
  }

  async generateForLead(tenantId: string, leadId: string, userId?: string, clientId?: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      include: { notes: true, deals: true }
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    await this.ensureClientBelongsToTenant(tenantId, clientId);

    const content = await this.aiService.generateForLead(lead);

    return this.create(tenantId, {
      title: `Security Services Proposal - ${lead.company}`,
      content,
      status: 'draft',
      leadId,
      clientId,
    }, userId);
  }

  async generateBulkProposals(tenantId: string, userId?: string) {
    const leads = await this.prisma.lead.findMany({
      where: { 
        tenantId,
        proposals: { none: {} }
      },
    });

    let generatedCount = 0;
    for (const lead of leads) {
      try {
        await this.generateForLead(tenantId, lead.id, userId);
        generatedCount++;
      } catch (error) {
        console.error(`Failed to generate proposal for lead ${lead.id}`, error);
      }
    }

    return { generatedCount, totalProcessed: leads.length };
  }

  async getComments(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.proposalComment.findMany({
      where: { proposalId: id, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(tenantId: string, id: string, userId: string, content: string) {
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

  async logAction(tenantId: string, userId: string, entityId: string, action: string, details?: string) {
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
