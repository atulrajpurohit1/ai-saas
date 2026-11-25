import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { SaleCampaignDto } from './dto/sale-campaign.dto';

@Injectable()
export class SaleCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  list() {
    return this.prisma.saleCampaign.findMany({
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        percentOff: true,
        bonusCredits: true,
        packageKeys: true,
        startsAt: true,
        endsAt: true,
        enabled: true,
        createdAt: true,
      },
    });
  }

  async create(dto: SaleCampaignDto) {
    this.validateDates(dto);
    this.validateName(dto.name);
    this.validateBenefits(dto);
    const couponId =
      dto.percentOff > 0
        ? await this.stripe.createSaleCoupon(dto.name, dto.percentOff)
        : null;
    return this.prisma.saleCampaign.create({
      data: {
        name: dto.name.trim(),
        percentOff: dto.percentOff,
        bonusCredits: dto.bonusCredits,
        packageKeys: dto.packageKeys,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        enabled: dto.enabled,
        stripeCouponId: couponId,
      },
    });
  }

  async update(id: string, dto: SaleCampaignDto) {
    this.validateDates(dto);
    this.validateName(dto.name);
    this.validateBenefits(dto);
    const old = await this.prisma.saleCampaign.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Sale not found.');
    const couponId =
      dto.percentOff === 0
        ? null
        : old.percentOff === dto.percentOff &&
            old.name === dto.name.trim() &&
            old.stripeCouponId
          ? old.stripeCouponId
          : await this.stripe.createSaleCoupon(dto.name, dto.percentOff);
    return this.prisma.saleCampaign.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        percentOff: dto.percentOff,
        bonusCredits: dto.bonusCredits,
        packageKeys: dto.packageKeys,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        enabled: dto.enabled,
        stripeCouponId: couponId,
      },
    });
  }

  async setEnabled(id: string, enabled: boolean) {
    await this.requireSale(id);
    return this.prisma.saleCampaign.update({
      where: { id },
      data: { enabled },
    });
  }

  async remove(id: string) {
    await this.requireSale(id);
    await this.prisma.saleCampaign.delete({ where: { id } });
    return { deleted: true };
  }

  private async requireSale(id: string) {
    const sale = await this.prisma.saleCampaign.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!sale) throw new NotFoundException('Sale not found.');
  }

  private validateDates(dto: SaleCampaignDto) {
    const start = new Date(dto.startsAt);
    const end = new Date(dto.endsAt);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    ) {
      throw new BadRequestException('Sale end must be after its start.');
    }
    if (end <= new Date())
      throw new BadRequestException('Sale end must be in the future.');
  }

  private validateName(name: string) {
    if (name.trim().length < 2)
      throw new BadRequestException(
        'Sale name must have at least two characters.',
      );
  }

  private validateBenefits(dto: SaleCampaignDto) {
    if (dto.percentOff === 0 && dto.bonusCredits === 0) {
      throw new BadRequestException(
        'Add a discount or bonus credits to the sale.',
      );
    }
  }
}
