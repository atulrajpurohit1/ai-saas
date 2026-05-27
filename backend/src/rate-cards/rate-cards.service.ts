import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRateCardDto, RATE_CARD_STATUSES } from './dto/create-rate-card.dto';
import { UpdateRateCardDto } from './dto/update-rate-card.dto';

@Injectable()
export class RateCardsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private rateCardInclude() {
    return {
      client: {
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
        },
      },
      site: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    } satisfies Prisma.RateCardInclude;
  }

  private mapRateCard(rateCard: any) {
    return {
      id: rateCard.id,
      tenantId: rateCard.tenantId,
      clientId: rateCard.clientId,
      siteId: rateCard.siteId,
      roleName: rateCard.roleName,
      hourlyRate: rateCard.hourlyRate,
      overtimeRate: rateCard.overtimeRate,
      holidayRate: rateCard.holidayRate,
      effectiveFrom: rateCard.effectiveFrom,
      effectiveTo: rateCard.effectiveTo,
      status: rateCard.status,
      createdAt: rateCard.createdAt,
      client: rateCard.client
        ? {
            id: rateCard.client.id,
            name: rateCard.client.name,
            companyName: rateCard.client.companyName,
            email: rateCard.client.email,
          }
        : null,
      site: rateCard.site
        ? {
            id: rateCard.site.id,
            name: rateCard.site.name,
            address: rateCard.site.address,
          }
        : null,
    };
  }

  private parseDate(value: string | undefined, fieldName: string) {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return parsed;
  }

  private parseOptionalDate(value: string | undefined, fieldName: string) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return parsed;
  }

  private parseOptionalRate(value: number | undefined) {
    if (value === undefined || value === null) {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('Rates must be greater than zero');
    }

    return Math.round(parsed * 100) / 100;
  }

  private async resolveClient(tenantId: string, clientIdInput?: string) {
    const clientId = clientIdInput?.trim();
    if (!clientId) {
      throw new BadRequestException('client_id is required');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { id: true, name: true, companyName: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  private async resolveSite(tenantId: string, clientId: string, siteIdInput?: string | null) {
    const siteId = siteIdInput?.trim() || null;
    if (!siteId) {
      return null;
    }

    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId, clientId },
      select: { id: true, name: true },
    });

    if (!site) {
      throw new BadRequestException('Site must belong to this client and tenant');
    }

    return site;
  }

  private validateEffectiveRange(effectiveFrom: Date, effectiveTo: Date | null) {
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('effective_to must be on or after effective_from');
    }
  }

  private async findRateCardOrThrow(tenantId: string, id: string) {
    const rateCard = await this.prisma.rateCard.findFirst({
      where: { id, tenantId },
      include: this.rateCardInclude(),
    });

    if (!rateCard) {
      throw new NotFoundException('Rate card not found');
    }

    return rateCard;
  }

  async create(tenantId: string, userId: string, dto: CreateRateCardDto) {
    const client = await this.resolveClient(tenantId, dto.client_id);
    const site = await this.resolveSite(tenantId, client.id, dto.site_id);
    const effectiveFrom = this.parseDate(dto.effective_from, 'effective_from');
    const effectiveTo = this.parseOptionalDate(dto.effective_to, 'effective_to');
    this.validateEffectiveRange(effectiveFrom, effectiveTo);

    const hourlyRate = Number(dto.hourly_rate);
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      throw new BadRequestException('hourly_rate must be greater than zero');
    }

    const rateCard = await this.prisma.rateCard.create({
      data: {
        tenantId,
        clientId: client.id,
        siteId: site?.id ?? null,
        roleName: dto.role_name?.trim() || null,
        hourlyRate: Math.round(hourlyRate * 100) / 100,
        overtimeRate: this.parseOptionalRate(dto.overtime_rate),
        holidayRate: this.parseOptionalRate(dto.holiday_rate),
        effectiveFrom,
        effectiveTo,
        status: dto.status || 'active',
      },
      include: this.rateCardInclude(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'RATE_CARD_CREATED',
      entityType: 'RateCard',
      entityId: rateCard.id,
      details: `Rate card created for "${client.companyName || client.name}"${site ? ` at "${site.name}"` : ''}`,
    });

    return this.mapRateCard(rateCard);
  }

  async findAll(tenantId: string, status?: string) {
    if (status && !RATE_CARD_STATUSES.includes(status as any)) {
      throw new BadRequestException('Invalid rate card status');
    }

    const rateCards = await this.prisma.rateCard.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: this.rateCardInclude(),
      orderBy: [{ status: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    return rateCards.map((rateCard) => this.mapRateCard(rateCard));
  }

  async findOne(tenantId: string, id: string) {
    const rateCard = await this.findRateCardOrThrow(tenantId, id);
    return this.mapRateCard(rateCard);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateRateCardDto) {
    const existing = await this.findRateCardOrThrow(tenantId, id);
    const client = dto.client_id === undefined ? null : await this.resolveClient(tenantId, dto.client_id);
    const clientId = client?.id ?? existing.clientId;
    const site =
      dto.site_id === undefined
        ? undefined
        : await this.resolveSite(tenantId, clientId, dto.site_id);

    const effectiveFrom =
      dto.effective_from === undefined
        ? existing.effectiveFrom
        : this.parseDate(dto.effective_from, 'effective_from');
    const effectiveTo =
      dto.effective_to === undefined
        ? existing.effectiveTo
        : this.parseOptionalDate(dto.effective_to, 'effective_to');
    this.validateEffectiveRange(effectiveFrom, effectiveTo);

    const updated = await this.prisma.rateCard.update({
      where: { id },
      data: {
        ...(dto.client_id !== undefined ? { clientId } : {}),
        ...(dto.site_id !== undefined ? { siteId: site?.id ?? null } : {}),
        ...(dto.role_name !== undefined ? { roleName: dto.role_name?.trim() || null } : {}),
        ...(dto.hourly_rate !== undefined
          ? { hourlyRate: this.parseOptionalRate(dto.hourly_rate) ?? existing.hourlyRate }
          : {}),
        ...(dto.overtime_rate !== undefined ? { overtimeRate: this.parseOptionalRate(dto.overtime_rate) } : {}),
        ...(dto.holiday_rate !== undefined ? { holidayRate: this.parseOptionalRate(dto.holiday_rate) } : {}),
        ...(dto.effective_from !== undefined ? { effectiveFrom } : {}),
        ...(dto.effective_to !== undefined ? { effectiveTo } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: this.rateCardInclude(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'RATE_CARD_UPDATED',
      entityType: 'RateCard',
      entityId: updated.id,
      details: `Rate card updated for "${updated.client.companyName || updated.client.name}"`,
    });

    return this.mapRateCard(updated);
  }

  async deactivate(tenantId: string, userId: string, id: string) {
    await this.findRateCardOrThrow(tenantId, id);

    const updated = await this.prisma.rateCard.update({
      where: { id },
      data: { status: 'inactive' },
      include: this.rateCardInclude(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'RATE_CARD_DEACTIVATED',
      entityType: 'RateCard',
      entityId: updated.id,
      details: `Rate card deactivated for "${updated.client.companyName || updated.client.name}"`,
    });

    return this.mapRateCard(updated);
  }
}
