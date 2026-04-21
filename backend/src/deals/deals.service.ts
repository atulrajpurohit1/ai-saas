import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DealsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createDealDto: CreateDealDto, tenantId: string, userId?: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: createDealDto.leadId, tenantId },
    });

    if (!lead) {
      throw new ForbiddenException('Lead not found');
    }

    const deal = await this.prisma.deal.create({
      data: {
        ...createDealDto,
        tenantId,
      },
      include: { lead: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'DEAL',
      entityId: deal.id,
      details: `Created deal: ${deal.name}`,
    });

    return deal;
  }

  async convertLeadToDeal(leadId: string, tenantId: string, userId?: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!lead) throw new NotFoundException('Lead not found');

    const deal = await this.prisma.deal.create({
      data: {
        name: `Deal for ${lead.company}`,
        leadId: lead.id,
        tenantId,
        stage: 'new',
      },
    });

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'converted' },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CONVERT_LEAD',
      entityType: 'DEAL',
      entityId: deal.id,
      details: `Converted lead ${lead.name} to deal`,
    });

    return deal;
  }

  async findAll(tenantId: string) {
    return this.prisma.deal.findMany({
      where: { tenantId },
      include: { lead: true, activities: true, notes: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, tenantId },
      include: { lead: true, activities: true, notes: true },
    });

    if (!deal) {
      throw new NotFoundException(`Deal with ID ${id} not found`);
    }

    return deal;
  }

  async updateStage(id: string, updateDealStageDto: UpdateDealStageDto, tenantId: string, userId?: string) {
    await this.findOne(id, tenantId);

    const deal = await this.prisma.deal.update({
      where: { id },
      data: { stage: updateDealStageDto.stage },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE_STAGE',
      entityType: 'DEAL',
      entityId: id,
      details: `Stage updated to ${updateDealStageDto.stage}`,
    });

    return deal;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    await this.findOne(id, tenantId);

    await this.prisma.deal.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'DEAL',
      entityId: id,
    });

    return { success: true };
  }
}
