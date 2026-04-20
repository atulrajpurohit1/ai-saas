import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';

import { AiService } from '../ai/ai.service';

@Injectable()
export class ProposalsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async create(tenantId: string, createProposalDto: CreateProposalDto) {
    return this.prisma.proposal.create({
      data: {
        ...createProposalDto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.proposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { lead: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, tenantId },
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
  ) {
    await this.findOne(tenantId, id); // Ensure it exists and belongs to tenant

    return this.prisma.proposal.update({
      where: { id },
      data: updateProposalDto,
    });
  }

  async duplicate(tenantId: string, id: string) {
    const existing = await this.findOne(tenantId, id);

    return this.prisma.proposal.create({
      data: {
        title: `${existing.title} (Copy)`,
        content: existing.content,
        status: 'draft', // Reset to draft for the new version
        tenantId,
      },
    });
  }

  async generateForLead(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    const content = await this.aiService.generateForLead(lead);

    return this.prisma.proposal.create({
      data: {
        title: `Security Services Proposal - ${lead.company}`,
        content,
        status: 'draft',
        tenantId,
        leadId,
      },
    });
  }

  async generateBulkProposals(tenantId: string) {
    // Only fetch leads that do NOT have a proposal attached
    const leads = await this.prisma.lead.findMany({
      where: { 
        tenantId,
        proposals: {
          none: {}
        }
      },
    });

    let generatedCount = 0;
    // Process sequentially to respect rate limits
    for (const lead of leads) {
      try {
        const content = await this.aiService.generateForLead(lead);
        await this.prisma.proposal.create({
          data: {
            title: `Security Services Proposal - ${lead.company}`,
            content,
            status: 'draft',
            tenantId,
            leadId: lead.id,
          },
        });
        generatedCount++;
      } catch (error) {
        console.error(`Failed to generate proposal for lead ${lead.id}`, error);
      }
    }

    return { generatedCount, totalProcessed: leads.length };
  }
}
