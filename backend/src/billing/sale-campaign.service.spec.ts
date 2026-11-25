import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { SaleCampaignService } from './sale-campaign.service';
import { SaleCampaignDto } from './dto/sale-campaign.dto';

describe('SaleCampaignService', () => {
  const tomorrow = () => new Date(Date.now() + 86400000).toISOString();
  const nextWeek = () => new Date(Date.now() + 7 * 86400000).toISOString();
  const input = (): SaleCampaignDto => ({
    name: 'Black Friday',
    percentOff: 25,
    bonusCredits: 1000,
    packageKeys: ['GUARD'],
    startsAt: tomorrow(),
    endsAt: nextWeek(),
    enabled: true,
  });

  let service: SaleCampaignService;
  let prisma: {
    saleCampaign: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let stripe: { createSaleCoupon: jest.Mock };

  beforeEach(() => {
    prisma = {
      saleCampaign: {
        create: jest.fn().mockResolvedValue({ id: 'sale-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'sale-1',
          name: 'Black Friday',
          percentOff: 25,
          stripeCouponId: 'coupon-original',
        }),
        update: jest.fn().mockResolvedValue({ id: 'sale-1' }),
      },
    };
    stripe = { createSaleCoupon: jest.fn().mockResolvedValue('coupon-new') };
    service = new SaleCampaignService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
    );
  });

  it('creates a Stripe coupon and stores its id with the scheduled sale', async () => {
    await service.create(input());
    expect(stripe.createSaleCoupon).toHaveBeenCalledWith('Black Friday', 25);
    expect(prisma.saleCampaign.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeCouponId: 'coupon-new',
        packageKeys: ['GUARD'],
      }),
    });
  });

  it('rejects an invalid date range before creating a coupon', async () => {
    await expect(
      service.create({ ...input(), endsAt: tomorrow(), startsAt: nextWeek() }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stripe.createSaleCoupon).not.toHaveBeenCalled();
  });

  it('creates a new coupon when the percentage changes', async () => {
    await service.update('sale-1', { ...input(), percentOff: 30 });
    expect(stripe.createSaleCoupon).toHaveBeenCalledWith('Black Friday', 30);
    expect(prisma.saleCampaign.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: expect.objectContaining({
        stripeCouponId: 'coupon-new',
        percentOff: 30,
      }),
    });
  });

  it('creates a credits-only sale without a coupon', async () => {
    await service.create({ ...input(), percentOff: 0 });
    expect(stripe.createSaleCoupon).not.toHaveBeenCalled();
    expect(prisma.saleCampaign.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bonusCredits: 1000,
        stripeCouponId: null,
      }),
    });
  });

  it('rejects a sale with no benefit', async () => {
    await expect(
      service.create({ ...input(), percentOff: 0, bonusCredits: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
