import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(tenantId: string, createProposalDto: CreateProposalDto, userId?: string) {
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
      entityType: 'PROPOSAL',
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
        _count: { select: { versions: true } }
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, tenantId },
      include: {
        lead: true,
        deal: true,
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
      entityType: 'PROPOSAL',
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

  async export(tenantId: string, id: string, userId?: string) {
    const proposal = await this.findOne(tenantId, id);
    
    await this.auditService.log({
      tenantId,
      userId,
      action: 'EXPORT',
      entityType: 'PROPOSAL',
      entityId: id,
      details: 'Exported proposal as PDF placeholder',
    });

    return { 
      content: proposal.content,
      title: proposal.title 
    };
  }

  async generateForLead(tenantId: string, leadId: string, userId?: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    const content = await this.aiService.generateForLead(lead);

    return this.create(tenantId, {
      title: `Security Services Proposal - ${lead.company}`,
      content,
      status: 'draft',
      leadId,
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

}
