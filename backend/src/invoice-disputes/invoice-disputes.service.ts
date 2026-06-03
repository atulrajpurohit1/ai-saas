import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloseInvoiceDisputeDto, RespondInvoiceDisputeDto } from './dto/respond-invoice-dispute.dto';

const ACTIVE_DISPUTE_STATUSES = ['open', 'under_review'];
const FINAL_DISPUTE_STATUSES = ['resolved', 'rejected'];

@Injectable()
export class InvoiceDisputesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private knowledgeBaseService: KnowledgeBaseService,
  ) {}

  private disputeInclude() {
    return {
      client: {
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          billingStartDate: true,
          billingEndDate: true,
          totalAmount: true,
          issuedAt: true,
          site: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      },
    } satisfies Prisma.InvoiceDisputeInclude;
  }

  private mapDispute(dispute: any) {
    return {
      id: dispute.id,
      invoiceId: dispute.invoiceId,
      clientId: dispute.clientId,
      tenantId: dispute.tenantId,
      reason: dispute.reason,
      description: dispute.description,
      status: dispute.status,
      adminResponse: dispute.adminResponse,
      createdAt: dispute.createdAt,
      resolvedAt: dispute.resolvedAt,
      client: dispute.client
        ? {
            id: dispute.client.id,
            name: dispute.client.name,
            companyName: dispute.client.companyName,
            email: dispute.client.email,
          }
        : null,
      invoice: dispute.invoice
        ? {
            id: dispute.invoice.id,
            invoiceNumber: dispute.invoice.invoiceNumber,
            status: dispute.invoice.status,
            billingStartDate: dispute.invoice.billingStartDate,
            billingEndDate: dispute.invoice.billingEndDate,
            totalAmount: dispute.invoice.totalAmount,
            issuedAt: dispute.invoice.issuedAt,
            site: dispute.invoice.site
              ? {
                  id: dispute.invoice.site.id,
                  name: dispute.invoice.site.name,
                  address: dispute.invoice.site.address,
                }
              : null,
          }
        : null,
    };
  }

  private async findDisputeOrThrow(tenantId: string, id: string) {
    const dispute = await this.prisma.invoiceDispute.findFirst({
      where: { id, tenantId },
      include: this.disputeInclude(),
    });

    if (!dispute) {
      throw new NotFoundException('Invoice dispute not found');
    }

    return dispute;
  }

  private assertActive(status: string) {
    if (FINAL_DISPUTE_STATUSES.includes(status)) {
      throw new BadRequestException('Invoice dispute has already been closed');
    }
  }

  private getResponse(dto?: CloseInvoiceDisputeDto | RespondInvoiceDisputeDto) {
    return dto?.admin_response?.trim() || undefined;
  }

  private async moveToUnderReview(tenantId: string, userId: string, dispute: any) {
    if (dispute.status !== 'open') {
      return dispute;
    }

    await this.prisma.invoiceDispute.update({
      where: { id: dispute.id },
      data: { status: 'under_review' },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'INVOICE_DISPUTE_UNDER_REVIEW',
      entityType: 'InvoiceDispute',
      entityId: dispute.id,
      details: `Invoice dispute for ${dispute.invoice?.invoiceNumber || dispute.invoiceId} moved under review`,
    });

    return this.findDisputeOrThrow(tenantId, dispute.id);
  }

  async findAll(tenantId: string) {
    const disputes = await this.prisma.invoiceDispute.findMany({
      where: { tenantId },
      include: this.disputeInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });

    return disputes.map((dispute) => this.mapDispute(dispute));
  }

  async findOne(tenantId: string, userId: string, id: string) {
    const dispute = await this.findDisputeOrThrow(tenantId, id);
    const reviewed = await this.moveToUnderReview(tenantId, userId, dispute);
    return this.mapDispute(reviewed);
  }

  async respond(tenantId: string, userId: string, id: string, dto: RespondInvoiceDisputeDto) {
    const response = this.getResponse(dto);

    if (!response) {
      throw new BadRequestException('admin_response is required');
    }

    const dispute = await this.findDisputeOrThrow(tenantId, id);
    this.assertActive(dispute.status);

    const updated = await this.prisma.invoiceDispute.update({
      where: { id },
      data: {
        status: 'under_review',
        adminResponse: response,
      },
      include: this.disputeInclude(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'INVOICE_DISPUTE_RESPONDED',
      entityType: 'InvoiceDispute',
      entityId: updated.id,
      details: `Admin responded to invoice dispute for ${updated.invoice.invoiceNumber}`,
    });

    return this.mapDispute(updated);
  }

  async resolve(tenantId: string, userId: string, id: string, dto?: CloseInvoiceDisputeDto) {
    const response = this.getResponse(dto);
    const dispute = await this.findDisputeOrThrow(tenantId, id);
    this.assertActive(dispute.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.invoiceDispute.update({
        where: { id },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          ...(response ? { adminResponse: response } : {}),
        },
        include: this.disputeInclude(),
      });

      await tx.invoice.updateMany({
        where: {
          id: closed.invoiceId,
          tenantId,
          status: { in: ['disputed', 'issued'] },
        },
        data: { status: 'resolved' },
      });

      return closed;
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'INVOICE_DISPUTE_RESOLVED',
      entityType: 'InvoiceDispute',
      entityId: updated.id,
      details: `Invoice dispute for ${updated.invoice.invoiceNumber} resolved`,
    });

    const resolved = await this.findDisputeOrThrow(tenantId, id);
    await this.knowledgeBaseService.createFromDispute(tenantId, userId, resolved);

    return this.mapDispute(resolved);
  }

  async reject(tenantId: string, userId: string, id: string, dto?: CloseInvoiceDisputeDto) {
    const response = this.getResponse(dto);
    const dispute = await this.findDisputeOrThrow(tenantId, id);
    this.assertActive(dispute.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.invoiceDispute.update({
        where: { id },
        data: {
          status: 'rejected',
          resolvedAt: new Date(),
          ...(response ? { adminResponse: response } : {}),
        },
        include: this.disputeInclude(),
      });

      await tx.invoice.updateMany({
        where: {
          id: closed.invoiceId,
          tenantId,
          status: 'disputed',
        },
        data: { status: 'issued' },
      });

      return closed;
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'INVOICE_DISPUTE_REJECTED',
      entityType: 'InvoiceDispute',
      entityId: updated.id,
      details: `Invoice dispute for ${updated.invoice.invoiceNumber} rejected`,
    });

    return this.mapDispute(await this.findDisputeOrThrow(tenantId, id));
  }
}
