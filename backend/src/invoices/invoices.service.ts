import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BrandingService } from '../branding/branding.service';
import { branchScopedWhere, branchWhere } from '../branches/branch-scope';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { DisputeInvoiceDto } from './dto/dispute-invoice.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';

const TAX_RATE = 0;
const CLIENT_VISIBLE_STATUSES = ['issued', 'disputed', 'resolved', 'paid'];
const PAYABLE_STATUSES = ['issued', 'resolved'];

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private webhooksService: WebhooksService,
    private brandingService: BrandingService,
  ) {}

  private parseBillingDate(value: string, fieldName: string) {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    let date: Date;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      date = new Date(Date.UTC(year, month - 1, day));

      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new BadRequestException(`${fieldName} must be a valid date`);
      }
    } else {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`${fieldName} must be a valid date`);
      }

      date = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
    }

    return date;
  }

  private parseBillingRange(dto: GenerateInvoiceDto) {
    const billingStartDate = this.parseBillingDate(dto.billing_start_date, 'billing_start_date');
    const billingEndDate = this.parseBillingDate(dto.billing_end_date, 'billing_end_date');

    if (billingEndDate < billingStartDate) {
      throw new BadRequestException('billing_end_date must be on or after billing_start_date');
    }

    const endExclusive = new Date(billingEndDate);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    return { billingStartDate, billingEndDate, endExclusive };
  }

  private roundHours(value: number) {
    return Math.round(value * 10) / 10;
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private formatDate(value: Date | string | null | undefined) {
    if (!value) {
      return 'N/A';
    }

    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private formatDateTime(value: Date | string | null | undefined) {
    if (!value) {
      return 'N/A';
    }

    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  private invoiceInclude() {
    return {
      client: {
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          phone: true,
        },
      },
      site: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
        },
      },
      rateCard: {
        select: {
          id: true,
          roleName: true,
          hourlyRate: true,
          overtimeRate: true,
          holidayRate: true,
          effectiveFrom: true,
          effectiveTo: true,
          status: true,
          clientId: true,
          siteId: true,
        },
      },
      items: {
        include: {
          shift: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              status: true,
            },
          },
          guard: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          rateCard: {
            select: {
              id: true,
              roleName: true,
              hourlyRate: true,
              siteId: true,
            },
          },
        },
        orderBy: {
          shift: {
            startTime: 'asc',
          },
        },
      },
      disputes: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    } satisfies Prisma.InvoiceInclude;
  }

  private mapInvoiceDispute(dispute: any) {
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
    };
  }

  private mapInvoice(invoice: any) {
    return {
      id: invoice.id,
      tenantId: invoice.tenantId,
      clientId: invoice.clientId,
      siteId: invoice.siteId,
      branchId: invoice.branchId,
      branch: invoice.branch
        ? {
            id: invoice.branch.id,
            name: invoice.branch.name,
            location: invoice.branch.location,
            status: invoice.branch.status,
          }
        : null,
      invoiceNumber: invoice.invoiceNumber,
      billingStartDate: invoice.billingStartDate,
      billingEndDate: invoice.billingEndDate,
      totalHours: invoice.totalHours,
      hourlyRate: invoice.hourlyRate,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
      createdAt: invoice.createdAt,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      dueDate: invoice.dueDate,
      rateCardId: invoice.rateCardId,
      rateSource: invoice.rateSource,
      rateCard: invoice.rateCard
        ? {
            id: invoice.rateCard.id,
            roleName: invoice.rateCard.roleName,
            hourlyRate: invoice.rateCard.hourlyRate,
            overtimeRate: invoice.rateCard.overtimeRate,
            holidayRate: invoice.rateCard.holidayRate,
            effectiveFrom: invoice.rateCard.effectiveFrom,
            effectiveTo: invoice.rateCard.effectiveTo,
            status: invoice.rateCard.status,
            clientId: invoice.rateCard.clientId,
            siteId: invoice.rateCard.siteId,
          }
        : null,
      client: invoice.client
        ? {
            id: invoice.client.id,
            name: invoice.client.name,
            companyName: invoice.client.companyName,
            email: invoice.client.email,
            phone: invoice.client.phone,
          }
        : null,
      site: invoice.site
        ? {
            id: invoice.site.id,
            name: invoice.site.name,
            address: invoice.site.address,
          }
        : null,
      items: Array.isArray(invoice.items)
        ? invoice.items.map((item) => ({
            id: item.id,
            invoiceId: item.invoiceId,
            rateCardId: item.rateCardId,
            shiftId: item.shiftId,
            guardId: item.guardId,
            workedHours: item.workedHours,
            hourlyRate: item.hourlyRate,
            amount: item.amount,
            shift: item.shift
              ? {
                  id: item.shift.id,
                  startTime: item.shift.startTime,
                  endTime: item.shift.endTime,
                  status: item.shift.status,
                }
              : null,
            guard: item.guard
              ? {
                  id: item.guard.id,
                  name: item.guard.name,
                  email: item.guard.email,
                  phone: item.guard.phone,
                }
              : null,
            rateCard: item.rateCard
              ? {
                  id: item.rateCard.id,
                  roleName: item.rateCard.roleName,
                  hourlyRate: item.rateCard.hourlyRate,
                  siteId: item.rateCard.siteId,
                }
              : null,
          }))
        : [],
      disputes: Array.isArray(invoice.disputes)
        ? invoice.disputes.map((dispute) => this.mapInvoiceDispute(dispute))
        : [],
    };
  }

  private async findInvoiceOrThrow(user: ActiveUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
      include: this.invoiceInclude(),
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private async findClientInvoiceOrThrow(tenantId: string, clientId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId,
        clientId,
        status: { in: CLIENT_VISIBLE_STATUSES },
      },
      include: this.invoiceInclude(),
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private async findClientOwnedInvoiceOrThrow(tenantId: string, clientId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId,
        clientId,
      },
      include: this.invoiceInclude(),
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private async resolveBillableClientAndSite(user: ActiveUser, clientIdInput: string, siteIdInput?: string) {
    const clientId = clientIdInput?.trim();
    const siteId = siteIdInput?.trim();

    if (!clientId) {
      throw new BadRequestException('client_id is required');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId, ...branchWhere(user) },
      select: {
        id: true,
        name: true,
        companyName: true,
        branchId: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, tenantId: user.tenantId, clientId, ...branchWhere(user) },
        select: {
          id: true,
          name: true,
          address: true,
          clientId: true,
          branchId: true,
        },
      });

      if (!site) {
        throw new BadRequestException('Site must belong to this client and tenant');
      }

      if (client.branchId && site.branchId && client.branchId !== site.branchId) {
        throw new BadRequestException('Client and site must belong to the same branch');
      }

      return { client, site };
    }

    const clientSites = await this.prisma.site.findMany({
      where: { tenantId: user.tenantId, clientId, ...branchWhere(user) },
      select: {
        id: true,
        name: true,
        address: true,
        clientId: true,
        branchId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (clientSites.length === 0) {
      throw new BadRequestException('Client must have a linked site before generating an invoice');
    }

    if (clientSites.length > 1) {
      throw new BadRequestException('site_id is required when the client has multiple linked sites');
    }

    return { client, site: clientSites[0] };
  }

  private async buildInvoiceItems(input: {
    tenantId: string;
    clientId: string;
    siteId: string;
    billingStartDate: Date;
    endExclusive: Date;
    hourlyRate: number;
    rateCardId: string | null;
  }) {
    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        tenantId: input.tenantId,
        siteId: input.siteId,
        status: 'approved',
        checkInTime: {
          gte: input.billingStartDate,
          lt: input.endExclusive,
        },
      },
      include: {
        shift: {
          select: {
            id: true,
            startTime: true,
          },
        },
        guard: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ checkInTime: 'asc' }, { createdAt: 'asc' }],
    });

    const billableTimesheets = timesheets.filter((timesheet) => this.roundHours(timesheet.totalHours) > 0);

    if (timesheets.length > 0 && billableTimesheets.length === 0) {
      throw new BadRequestException(
        'Approved timesheets found for this billing period, but they have 0 billable hours. Correct the timesheet hours before generating an invoice.',
      );
    }

    const items = billableTimesheets.map((timesheet) => {
      const workedHours = this.roundHours(timesheet.totalHours);

      return {
        timesheetId: timesheet.id,
        rateCardId: input.rateCardId,
        shiftId: timesheet.shiftId,
        guardId: timesheet.guardId,
        workedHours,
        hourlyRate: input.hourlyRate,
        amount: this.roundCurrency(workedHours * input.hourlyRate),
      };
    });

    if (items.length === 0) {
      throw new BadRequestException('No approved timesheets found for this billing period');
    }

    const totalHours = this.roundHours(items.reduce((sum, item) => sum + item.workedHours, 0));
    const subtotal = this.roundCurrency(items.reduce((sum, item) => sum + item.amount, 0));
    const tax = this.roundCurrency(subtotal * TAX_RATE);
    const totalAmount = this.roundCurrency(subtotal + tax);

    return { items, totalHours, subtotal, tax, totalAmount };
  }

  private async findActiveRateCard(input: {
    tenantId: string;
    clientId: string;
    siteId: string;
    billingStartDate: Date;
    billingEndDate: Date;
  }) {
    const baseWhere = {
      tenantId: input.tenantId,
      clientId: input.clientId,
      status: 'active',
      effectiveFrom: { lte: input.billingEndDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.billingStartDate } }],
    };

    const siteRateCard = await this.prisma.rateCard.findFirst({
      where: {
        ...baseWhere,
        siteId: input.siteId,
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (siteRateCard) {
      return { rateCard: siteRateCard, rateSource: 'site_rate_card' };
    }

    const clientRateCard = await this.prisma.rateCard.findFirst({
      where: {
        ...baseWhere,
        siteId: null,
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (clientRateCard) {
      return { rateCard: clientRateCard, rateSource: 'client_rate_card' };
    }

    return { rateCard: null, rateSource: 'manual' };
  }

  private async resolveInvoiceRate(input: {
    tenantId: string;
    clientId: string;
    siteId: string;
    billingStartDate: Date;
    billingEndDate: Date;
    dto: GenerateInvoiceDto;
  }) {
    const manualRate = Number(input.dto.hourly_rate);
    if (input.dto.allow_manual_rate && Number.isFinite(manualRate) && manualRate > 0) {
      return {
        hourlyRate: this.roundCurrency(manualRate),
        rateCardId: null,
        rateSource: 'manual',
      };
    }

    const { rateCard, rateSource } = await this.findActiveRateCard(input);

    if (rateCard) {
      return {
        hourlyRate: this.roundCurrency(rateCard.hourlyRate),
        rateCardId: rateCard.id,
        rateSource,
      };
    }

    throw new BadRequestException(
      'No active rate card found for this client/site and billing period. Create a client or site rate card, or enable manual rate fallback.',
    );
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  async generateInvoice(user: ActiveUser, dto: GenerateInvoiceDto) {
    const { billingStartDate, billingEndDate, endExclusive } = this.parseBillingRange(dto);
    const { client, site } = await this.resolveBillableClientAndSite(user, dto.client_id, dto.site_id);

    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        tenantId: user.tenantId,
        clientId: client.id,
        siteId: site.id,
        billingStartDate,
        billingEndDate,
      },
      select: { id: true, invoiceNumber: true },
    });

    if (existingInvoice) {
      throw new ConflictException(`Invoice ${existingInvoice.invoiceNumber} already exists for this client, site, and billing period`);
    }

    const rate = await this.resolveInvoiceRate({
      tenantId: user.tenantId,
      clientId: client.id,
      siteId: site.id,
      billingStartDate,
      billingEndDate,
      dto,
    });

    const totals = await this.buildInvoiceItems({
      tenantId: user.tenantId,
      clientId: client.id,
      siteId: site.id,
      billingStartDate,
      endExclusive,
      hourlyRate: rate.hourlyRate,
      rateCardId: rate.rateCardId,
    });

    try {
      const invoice = await this.prisma.$transaction(
        async (tx) => {
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const tomorrowStart = new Date(todayStart);
          tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

          const sequence = await tx.invoice.count({
            where: {
              tenantId: user.tenantId,
              createdAt: {
                gte: todayStart,
                lt: tomorrowStart,
              },
            },
          });

          const datePart = todayStart.toISOString().slice(0, 10).replace(/-/g, '');
          const invoiceNumber = `INV-${datePart}-${String(sequence + 1).padStart(4, '0')}`;

          return tx.invoice.create({
            data: {
              tenantId: user.tenantId,
              clientId: client.id,
              siteId: site.id,
              branchId: site.branchId,
              invoiceNumber,
              billingStartDate,
              billingEndDate,
              totalHours: totals.totalHours,
              hourlyRate: rate.hourlyRate,
              rateCardId: rate.rateCardId,
              rateSource: rate.rateSource,
              subtotal: totals.subtotal,
              tax: totals.tax,
              totalAmount: totals.totalAmount,
              status: 'draft',
              items: {
                create: totals.items,
              },
            },
            include: this.invoiceInclude(),
          });
        },
        { maxWait: 10_000, timeout: 30_000 },
      );

      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'INVOICE_GENERATED',
        entityType: 'Invoice',
        entityId: invoice.id,
        details: `Invoice ${invoice.invoiceNumber} generated for "${client.companyName || client.name}" at "${site.name}" using ${rate.rateSource}`,
      });

      const mappedInvoice = this.mapInvoice(invoice);
      await this.webhooksService.triggerEvent(user.tenantId, 'invoice.generated', {
        invoice: mappedInvoice,
      });

      return mappedInvoice;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('An invoice already exists for this billing period or invoice number');
      }

      throw error;
    }
  }

  async findAllForAdmin(user: ActiveUser, requestedBranchId?: string | null) {
    const invoices = await this.prisma.invoice.findMany({
      where: branchScopedWhere(user, requestedBranchId),
      include: this.invoiceInclude(),
      orderBy: [{ createdAt: 'desc' }, { invoiceNumber: 'desc' }],
    });

    return invoices.map((invoice) => this.mapInvoice(invoice));
  }

  async findOneForAdmin(user: ActiveUser, id: string) {
    const invoice = await this.findInvoiceOrThrow(user, id);
    return this.mapInvoice(invoice);
  }

  async issueInvoice(user: ActiveUser, id: string) {
    const existing = await this.findInvoiceOrThrow(user, id);

    if (existing.status === 'issued' || existing.status === 'paid') {
      return this.mapInvoice(existing);
    }

    if (!['draft', 'resolved'].includes(existing.status)) {
      throw new BadRequestException('Only draft or resolved invoices can be issued');
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'issued',
        issuedAt: new Date(),
      },
      include: this.invoiceInclude(),
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'INVOICE_ISSUED',
      entityType: 'Invoice',
      entityId: invoice.id,
      details: `Invoice ${invoice.invoiceNumber} issued`,
    });

    return this.mapInvoice(invoice);
  }

  async markPaid(user: ActiveUser, id: string) {
    const existing = await this.findInvoiceOrThrow(user, id);

    if (existing.status === 'paid') {
      return this.mapInvoice(existing);
    }

    if (!PAYABLE_STATUSES.includes(existing.status)) {
      throw new BadRequestException('Only issued or resolved invoices can be marked paid');
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date() },
      include: this.invoiceInclude(),
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'INVOICE_MARKED_PAID',
      entityType: 'Invoice',
      entityId: invoice.id,
      details: `Invoice ${invoice.invoiceNumber} marked paid`,
    });

    const mappedInvoice = this.mapInvoice(invoice);
    await this.webhooksService.triggerEvent(user.tenantId, 'invoice.paid', {
      invoice: mappedInvoice,
    });

    return mappedInvoice;
  }

  async cancelInvoice(user: ActiveUser, id: string) {
    const existing = await this.findInvoiceOrThrow(user, id);

    if (existing.status === 'cancelled') {
      return this.mapInvoice(existing);
    }

    if (existing.status === 'paid') {
      throw new BadRequestException('Paid invoices cannot be cancelled');
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'cancelled' },
      include: this.invoiceInclude(),
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'INVOICE_CANCELLED',
      entityType: 'Invoice',
      entityId: invoice.id,
      details: `Invoice ${invoice.invoiceNumber} cancelled`,
    });

    return this.mapInvoice(invoice);
  }

  async acceptInvoice(tenantId: string, clientId: string, userId: string, id: string) {
    if (!clientId) {
      throw new ForbiddenException('Client access required');
    }

    const existing = await this.findClientOwnedInvoiceOrThrow(tenantId, clientId, id);

    if (!['issued', 'resolved'].includes(existing.status)) {
      throw new BadRequestException('Only issued or resolved invoices can be accepted');
    }

    const invoice = existing.status === 'resolved'
      ? await this.prisma.invoice.update({
          where: { id },
          data: { status: 'issued' },
          include: this.invoiceInclude(),
        })
      : existing;

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_INVOICE_ACCEPTED',
      entityType: 'Invoice',
      entityId: invoice.id,
      details: `Client accepted invoice ${invoice.invoiceNumber}`,
    });

    return this.mapInvoice(invoice);
  }

  async disputeInvoice(
    tenantId: string,
    clientId: string,
    userId: string,
    id: string,
    dto: DisputeInvoiceDto,
  ) {
    if (!clientId) {
      throw new ForbiddenException('Client access required');
    }

    const reason = dto.reason?.trim();
    const description = dto.description?.trim();

    if (!reason || !description) {
      throw new BadRequestException('Dispute reason and description are required');
    }

    const existing = await this.findClientOwnedInvoiceOrThrow(tenantId, clientId, id);

    if (existing.status !== 'issued') {
      throw new BadRequestException('Only issued invoices can be disputed');
    }

    const openDispute = await this.prisma.invoiceDispute.findFirst({
      where: {
        tenantId,
        clientId,
        invoiceId: existing.id,
        status: { in: ['open', 'under_review'] },
      },
      select: { id: true },
    });

    if (openDispute) {
      throw new ConflictException('This invoice already has an open dispute');
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceDispute.create({
        data: {
          tenantId,
          clientId,
          invoiceId: existing.id,
          reason,
          description,
          status: 'open',
        },
      });

      return tx.invoice.update({
        where: { id: existing.id },
        data: { status: 'disputed' },
        include: this.invoiceInclude(),
      });
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_INVOICE_DISPUTED',
      entityType: 'Invoice',
      entityId: invoice.id,
      details: `Client disputed invoice ${invoice.invoiceNumber}: ${reason}`,
    });

    return this.mapInvoice(invoice);
  }

  async findAllForClient(tenantId: string, clientId: string) {
    if (!clientId) {
      throw new ForbiddenException('Client access required');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        clientId,
        status: { in: CLIENT_VISIBLE_STATUSES },
      },
      include: this.invoiceInclude(),
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return invoices.map((invoice) => this.mapInvoice(invoice));
  }

  async findOneForClient(tenantId: string, clientId: string, id: string) {
    if (!clientId) {
      throw new ForbiddenException('Client access required');
    }

    const invoice = await this.findClientInvoiceOrThrow(tenantId, clientId, id);
    return this.mapInvoice(invoice);
  }

  private addPdfSectionTitle(doc: any, title: string) {
    doc.moveDown(0.8);
    doc.fontSize(15).fillColor('#111827').text(title);
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.5);
  }

  private async buildPdfBuffer(invoice: any): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks: Buffer[] = [];
    const branding = await this.brandingService.brandingSnapshot(invoice.tenantId);

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.brandingService.addPdfHeader(doc, 'Invoice', branding);
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor(branding.secondary_color).text(invoice.invoiceNumber, { align: 'right' });
      doc.moveDown();

      doc.fontSize(11).fillColor('#374151');
      doc.text(`Status: ${invoice.status}`);
      doc.text(`Billing period: ${this.formatDate(invoice.billingStartDate)} to ${this.formatDate(invoice.billingEndDate)}`);
      doc.text(`Issued: ${this.formatDate(invoice.issuedAt)}`);
      doc.text(`Rate source: ${invoice.rateSource || 'manual'}`);
      doc.moveDown();

      doc.fontSize(12).fillColor('#111827').text(`Client: ${invoice.client.companyName || invoice.client.name}`);
      doc.fontSize(11).fillColor('#374151');
      doc.text(`Email: ${invoice.client.email}`);
      if (invoice.client.phone) {
        doc.text(`Phone: ${invoice.client.phone}`);
      }
      doc.text(`Site: ${invoice.site.name}`);
      doc.text(`Address: ${invoice.site.address}`);

      this.addPdfSectionTitle(doc, 'Shift Work Summary');
      if (!invoice.items.length) {
        doc.fontSize(11).fillColor('#6b7280').text('No billable work items.');
      } else {
        invoice.items.forEach((item, index) => {
          doc.fontSize(11).fillColor('#111827').text(
            `${index + 1}. ${item.guard.name} - ${this.formatDateTime(item.shift.startTime)} to ${this.formatDateTime(item.shift.endTime)}`,
          );
          doc.fontSize(10).fillColor('#374151').text(
            `Shift ${item.shift.id} | ${item.workedHours}h x ${this.formatCurrency(item.hourlyRate)} = ${this.formatCurrency(item.amount)}`,
          );
          doc.moveDown(0.35);
        });
      }

      this.addPdfSectionTitle(doc, 'Totals');
      doc.fontSize(11).fillColor('#374151');
      doc.text(`Total hours: ${invoice.totalHours}`);
      doc.text(`Hourly rate: ${this.formatCurrency(invoice.hourlyRate)}`);
      if (invoice.rateCard) {
        doc.text(`Rate card: ${invoice.rateCard.roleName || invoice.rateCard.id}`);
      }
      doc.text(`Subtotal: ${this.formatCurrency(invoice.subtotal)}`);
      doc.text(`Tax: ${this.formatCurrency(invoice.tax)}`);
      doc.moveDown(0.2);
      doc.fontSize(14).fillColor('#111827').text(`Total amount: ${this.formatCurrency(invoice.totalAmount)}`);

      doc.end();
    });
  }

  async exportForAdmin(user: ActiveUser, id: string) {
    const invoice = await this.findInvoiceOrThrow(user, id);
    const buffer = await this.buildPdfBuffer(invoice);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'INVOICE_DOWNLOADED',
      entityType: 'Invoice',
      entityId: invoice.id,
      details: `Admin downloaded invoice ${invoice.invoiceNumber}`,
    });

    return { buffer, invoice: this.mapInvoice(invoice) };
  }

  async downloadForClient(tenantId: string, clientId: string, userId: string, id: string) {
    if (!clientId) {
      throw new ForbiddenException('Client access required');
    }

    const invoice = await this.findClientInvoiceOrThrow(tenantId, clientId, id);
    const buffer = await this.buildPdfBuffer(invoice);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_INVOICE_DOWNLOADED',
      entityType: 'Invoice',
      entityId: invoice.id,
      details: `Client downloaded invoice ${invoice.invoiceNumber}`,
    });

    return { buffer, invoice: this.mapInvoice(invoice) };
  }
}
