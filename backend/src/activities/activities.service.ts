import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(data: {
    type: string;
    subject: string;
    description?: string;
    dueDate?: Date;
    dealId?: string;
    tenantId: string;
    userId?: string;
  }) {
    const activity = await this.prisma.activity.create({
      data: {
        type: data.type,
        subject: data.subject,
        description: data.description,
        dueDate: data.dueDate,
        dealId: data.dealId,
        tenantId: data.tenantId,
      },
    });

    await this.auditService.log({
      tenantId: data.tenantId,
      userId: data.userId,
      action: 'CREATE',
      entityType: 'ACTIVITY',
      entityId: activity.id,
      details: `Scheduled ${data.type}: ${data.subject}`,
    });

    return activity;
  }

  async findAll(tenantId: string, dealId?: string) {
    return this.prisma.activity.findMany({
      where: {
        tenantId,
        ...(dealId ? { dealId } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async updateStatus(id: string, status: string, tenantId: string, userId?: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, tenantId },
    });

    if (!activity) throw new NotFoundException('Activity not found');

    const updated = await this.prisma.activity.update({
      where: { id },
      data: { status },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE_STATUS',
      entityType: 'ACTIVITY',
      entityId: id,
      details: `Updated activity status to ${status}`,
    });

    return updated;
  }
}
