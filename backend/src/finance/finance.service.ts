import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface FinanceInvoiceFilters {
  start_date?: string | string[];
  end_date?: string | string[];
  client_id?: string | string[];
  status?: string | string[];
}

const INVOICE_STATUSES = ['draft', 'issued', 'disputed', 'resolved', 'paid', 'cancelled'] as const;
const DISPUTE_STATUSES = ['open', 'under_review', 'resolved', 'rejected'] as const;
const ISSUED_LIFECYCLE_STATUSES = ['issued', 'disputed', 'resolved', 'paid'];
const OUTSTANDING_STATUSES = ['issued', 'resolved'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private getFilterValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private normalizeOptionalFilter(value: string | string[] | undefined) {
    const trimmed = this.getFilterValue(value)?.trim();
    return trimmed && trimmed !== 'all' ? trimmed : undefined;
  }

  private parseDateBoundary(value: string | string[] | undefined, fieldName: string) {
    const trimmed = this.getFilterValue(value)?.trim();
    if (!trimmed) {
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));

      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new BadRequestException(`${fieldName} must be a valid date`);
      }

      return { date, dateOnly: true };
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return { date: parsed, dateOnly: false };
  }

  private assertInvoiceStatus(status?: string) {
    if (status && !INVOICE_STATUSES.includes(status as (typeof INVOICE_STATUSES)[number])) {
      throw new BadRequestException('Invalid invoice status');
    }
  }

  private assertDisputeStatus(status?: string) {
    if (status && !DISPUTE_STATUSES.includes(status as (typeof DISPUTE_STATUSES)[number])) {
      throw new BadRequestException('Invalid dispute status');
    }
  }

  private getDateRange(filters: FinanceInvoiceFilters) {
    let startBoundary = this.parseDateBoundary(filters.start_date, 'start_date');
    let endBoundary = this.parseDateBoundary(filters.end_date, 'end_date');

    if (startBoundary && endBoundary && endBoundary.date < startBoundary.date) {
      [startBoundary, endBoundary] = [endBoundary, startBoundary];
    }

    const start = startBoundary?.date;
    const end = endBoundary ? new Date(endBoundary.date) : undefined;

    if (end && endBoundary?.dateOnly) {
      end.setUTCDate(end.getUTCDate() + 1);
    }

    return { start, end };
  }

  private applyInvoiceDateRange(
    where: Prisma.InvoiceWhereInput,
    filters: FinanceInvoiceFilters,
    field: 'issuedAt' | 'paidAt' | 'dueDate' = 'issuedAt',
  ) {
    const { start, end } = this.getDateRange(filters);
    if (!start && !end) {
      return;
    }

    const range: Prisma.DateTimeNullableFilter = {};
    if (start) {
      range.gte = start;
    }
    if (end) {
      range.lt = end;
    }

    if (field === 'paidAt') {
      where.paidAt = range;
    } else if (field === 'dueDate') {
      where.dueDate = range;
    } else {
      where.issuedAt = range;
    }
  }

  private buildInvoiceWhere(
    tenantId: string,
    filters: FinanceInvoiceFilters,
    dateField: 'issuedAt' | 'paidAt' | 'dueDate' = 'issuedAt',
  ): Prisma.InvoiceWhereInput {
    const clientId = this.normalizeOptionalFilter(filters.client_id);
    const status = this.normalizeOptionalFilter(filters.status);
    this.assertInvoiceStatus(status);

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
    };

    this.applyInvoiceDateRange(where, filters, dateField);
    return where;
  }

  private buildDisputeWhere(tenantId: string, filters: FinanceInvoiceFilters): Prisma.InvoiceDisputeWhereInput {
    const clientId = this.normalizeOptionalFilter(filters.client_id);
    const status = this.normalizeOptionalFilter(filters.status);
    this.assertDisputeStatus(status);

    const where: Prisma.InvoiceDisputeWhereInput = {
      tenantId,
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
    };

    const { start, end } = this.getDateRange(filters);
    if (start || end) {
      where.createdAt = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lt: end } : {}),
      };
    }

    return where;
  }

  private invoiceReportInclude() {
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
        },
      },
      disputes: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    } satisfies Prisma.InvoiceInclude;
  }

  private disputeReportInclude() {
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
          totalAmount: true,
          issuedAt: true,
          paidAt: true,
          dueDate: true,
          site: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    } satisfies Prisma.InvoiceDisputeInclude;
  }

  private clientName(client: { name: string; companyName: string | null } | null | undefined) {
    return client?.companyName || client?.name || '';
  }

  private formatDateOnly(value: Date | string | null | undefined) {
    if (!value) {
      return '';
    }

    return new Date(value).toISOString().slice(0, 10);
  }

  private formatDateTime(value: Date | string | null | undefined) {
    if (!value) {
      return '';
    }

    return new Date(value).toISOString();
  }

  private formatBillingPeriod(invoice: { billingStartDate: Date; billingEndDate: Date }) {
    return `${this.formatDateOnly(invoice.billingStartDate)} to ${this.formatDateOnly(invoice.billingEndDate)}`;
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private sumInvoices(invoices: Array<{ totalAmount: number }>) {
    return this.roundCurrency(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
  }

  private csvEscape(value: string | number | null | undefined) {
    if (value === null || value === undefined) {
      return '';
    }

    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private buildCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
    return [
      headers.map((header) => this.csvEscape(header)).join(','),
      ...rows.map((row) => row.map((value) => this.csvEscape(value)).join(',')),
    ].join('\r\n');
  }

  private async logReportViewed(tenantId: string, userId: string, reportName: string) {
    await this.auditService.log({
      tenantId,
      userId,
      action: 'FINANCE_REPORT_VIEWED',
      entityType: 'FinanceReport',
      details: `${reportName} viewed`,
    });
  }

  async getDashboard(tenantId: string, userId: string, filters: FinanceInvoiceFilters) {
    const invoices = await this.prisma.invoice.findMany({
      where: this.buildInvoiceWhere(tenantId, filters),
      select: {
        id: true,
        status: true,
        totalAmount: true,
      },
    });

    const invoiceCountByStatus = INVOICE_STATUSES.reduce<Record<string, number>>((counts, status) => {
      counts[status] = 0;
      return counts;
    }, {});

    invoices.forEach((invoice) => {
      invoiceCountByStatus[invoice.status] = (invoiceCountByStatus[invoice.status] || 0) + 1;
    });

    await this.logReportViewed(tenantId, userId, 'Finance dashboard');

    return {
      totalIssuedAmount: this.sumInvoices(
        invoices.filter((invoice) => ISSUED_LIFECYCLE_STATUSES.includes(invoice.status)),
      ),
      totalPaidAmount: this.sumInvoices(invoices.filter((invoice) => invoice.status === 'paid')),
      outstandingAmount: this.sumInvoices(invoices.filter((invoice) => OUTSTANDING_STATUSES.includes(invoice.status))),
      disputedAmount: this.sumInvoices(invoices.filter((invoice) => invoice.status === 'disputed')),
      invoiceCountByStatus,
    };
  }

  async exportInvoicesCsv(tenantId: string, userId: string, filters: FinanceInvoiceFilters) {
    const invoices = await this.prisma.invoice.findMany({
      where: this.buildInvoiceWhere(tenantId, filters),
      include: this.invoiceReportInclude(),
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }, { invoiceNumber: 'desc' }],
    });

    const csv = this.buildCsv(
      [
        'invoice_number',
        'client_name',
        'site_name',
        'billing_period',
        'total_hours',
        'subtotal',
        'tax',
        'total_amount',
        'status',
        'issued_at',
        'paid_at',
      ],
      invoices.map((invoice) => [
        invoice.invoiceNumber,
        this.clientName(invoice.client),
        invoice.site?.name || '',
        this.formatBillingPeriod(invoice),
        invoice.totalHours,
        invoice.subtotal,
        invoice.tax,
        invoice.totalAmount,
        invoice.status,
        this.formatDateTime(invoice.issuedAt),
        this.formatDateTime(invoice.paidAt),
      ]),
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'FINANCE_EXPORT_GENERATED',
      entityType: 'Invoice',
      details: `Invoice CSV export generated with ${invoices.length} rows`,
    });

    return {
      csv,
      filename: `finance-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  async getPaymentReport(tenantId: string, userId: string, filters: FinanceInvoiceFilters) {
    const where = this.buildInvoiceWhere(tenantId, { ...filters, status: 'paid' }, 'paidAt');

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: this.invoiceReportInclude(),
      orderBy: [{ paidAt: 'desc' }, { issuedAt: 'desc' }, { invoiceNumber: 'desc' }],
    });

    await this.logReportViewed(tenantId, userId, 'Payment report');

    return invoices.map((invoice) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentStatus: invoice.status,
      amount: invoice.totalAmount,
      paidDate: invoice.paidAt,
      issuedAt: invoice.issuedAt,
      client: invoice.client
        ? {
            id: invoice.client.id,
            name: invoice.client.name,
            companyName: invoice.client.companyName,
            email: invoice.client.email,
          }
        : null,
      site: invoice.site
        ? {
            id: invoice.site.id,
            name: invoice.site.name,
          }
        : null,
    }));
  }

  async getOutstandingReport(tenantId: string, userId: string, filters: FinanceInvoiceFilters) {
    const where = this.buildInvoiceWhere(tenantId, filters);
    where.status = { in: OUTSTANDING_STATUSES };

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: this.invoiceReportInclude(),
      orderBy: [{ dueDate: 'asc' }, { issuedAt: 'desc' }, { invoiceNumber: 'desc' }],
    });
    const now = new Date();

    await this.logReportViewed(tenantId, userId, 'Outstanding invoice report');

    return invoices.map((invoice) => {
      const isOverdue = Boolean(invoice.dueDate && invoice.dueDate < now);
      const daysOverdue = isOverdue && invoice.dueDate ? Math.ceil((now.getTime() - invoice.dueDate.getTime()) / MS_PER_DAY) : 0;

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        amount: invoice.totalAmount,
        issuedAt: invoice.issuedAt,
        dueDate: invoice.dueDate,
        isOverdue,
        daysOverdue,
        client: invoice.client
          ? {
              id: invoice.client.id,
              name: invoice.client.name,
              companyName: invoice.client.companyName,
              email: invoice.client.email,
            }
          : null,
        site: invoice.site
          ? {
              id: invoice.site.id,
              name: invoice.site.name,
            }
          : null,
      };
    });
  }

  async getDisputeReport(tenantId: string, userId: string, filters: FinanceInvoiceFilters) {
    const disputes = await this.prisma.invoiceDispute.findMany({
      where: this.buildDisputeWhere(tenantId, filters),
      include: this.disputeReportInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });

    await this.logReportViewed(tenantId, userId, 'Dispute report');

    return disputes.map((dispute) => ({
      disputeId: dispute.id,
      invoiceId: dispute.invoiceId,
      invoiceNumber: dispute.invoice?.invoiceNumber || '',
      disputeReason: dispute.reason,
      description: dispute.description,
      status: dispute.status,
      amount: dispute.invoice?.totalAmount || 0,
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
      invoiceStatus: dispute.invoice?.status || null,
      site: dispute.invoice?.site
        ? {
            id: dispute.invoice.site.id,
            name: dispute.invoice.site.name,
          }
        : null,
    }));
  }
}
