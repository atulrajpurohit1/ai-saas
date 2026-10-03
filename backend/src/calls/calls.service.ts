import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LogCallDto } from './dto/log-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { normalizePhoneNumber } from './phone.util';

@Injectable()
export class CallsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Records that a rep initiated a dial. Called the moment the tel: link opens,
   * not when the call ends -- the app never learns whether it connected, so the
   * row starts at outcome "dialed" and the rep settles it afterwards.
   */
  async logCall(dto: LogCallDto, tenantId: string, userId?: string) {
    const phoneNumber = normalizePhoneNumber(
      dto.phoneNumber,
      process.env.DEFAULT_PHONE_COUNTRY_CODE,
    );

    // Ownership check before writing: a leadId from another tenant must not be
    // attachable to this tenant's call record.
    if (dto.leadId) await this.assertLead(dto.leadId, tenantId);
    if (dto.dealId) await this.assertDeal(dto.dealId, tenantId);

    const call = await this.prisma.callRecord.create({
      data: {
        tenantId,
        leadId: dto.leadId || null,
        dealId: dto.dealId || null,
        phoneNumber,
        outcome: dto.outcome || 'dialed',
        durationSec: dto.durationSec ?? null,
        notes: dto.notes || null,
        createdBy: userId || null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'CALL',
      entityId: call.id,
      details: `Dialed ${phoneNumber}`,
    });

    return call;
  }

  async findAll(
    tenantId: string,
    filters: { leadId?: string; dealId?: string; limit?: number } = {},
  ) {
    return this.prisma.callRecord.findMany({
      where: {
        tenantId,
        ...(filters.leadId ? { leadId: filters.leadId } : {}),
        ...(filters.dealId ? { dealId: filters.dealId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 50, 200),
      include: {
        lead: { select: { id: true, name: true, company: true } },
        deal: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const call = await this.prisma.callRecord.findFirst({
      where: { id, tenantId },
      include: {
        lead: { select: { id: true, name: true, company: true } },
        deal: { select: { id: true, name: true } },
      },
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async update(
    id: string,
    dto: UpdateCallDto,
    tenantId: string,
    userId?: string,
  ) {
    await this.findOne(id, tenantId);

    const call = await this.prisma.callRecord.update({
      where: { id },
      data: {
        ...(dto.outcome !== undefined ? { outcome: dto.outcome } : {}),
        ...(dto.durationSec !== undefined
          ? { durationSec: dto.durationSec }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.transcript !== undefined ? { transcript: dto.transcript } : {}),
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'CALL',
      entityId: call.id,
      details: `Updated call to ${call.phoneNumber} (${call.outcome})`,
    });

    return call;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const call = await this.findOne(id, tenantId);
    await this.prisma.callRecord.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'CALL',
      entityId: id,
      details: `Deleted call record for ${call.phoneNumber}`,
    });

    return { success: true };
  }

  private async assertLead(leadId: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
  }

  private async assertDeal(dealId: string, tenantId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      select: { id: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
  }
}
