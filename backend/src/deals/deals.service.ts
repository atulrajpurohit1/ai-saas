import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';

@Injectable()
export class DealsService {
  constructor(private prisma: PrismaService) {}

  async create(createDealDto: CreateDealDto, tenantId: string) {
    // Verify lead belongs to tenant
    const lead = await this.prisma.lead.findFirst({
      where: { id: createDealDto.leadId, tenantId },
    });

    if (!lead) {
      throw new ForbiddenException(
        'Lead not found or does not belong to your tenant',
      );
    }

    return this.prisma.deal.create({
      data: {
        ...createDealDto,
        tenantId,
      },
      include: { lead: true },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.deal.findMany({
      where: { tenantId },
      include: { lead: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, tenantId },
      include: { lead: true },
    });

    if (!deal) {
      throw new NotFoundException(
        `Deal with ID ${id} not found for this tenant`,
      );
    }

    return deal;
  }

  async updateStage(
    id: string,
    updateDealStageDto: UpdateDealStageDto,
    tenantId: string,
  ) {
    // Verify ownership
    await this.findOne(id, tenantId);

    return this.prisma.deal.update({
      where: { id },
      data: { stage: updateDealStageDto.stage },
    });
  }

  async remove(id: string, tenantId: string) {
    // Verify ownership
    await this.findOne(id, tenantId);

    return this.prisma.deal.delete({
      where: { id },
    });
  }
}
