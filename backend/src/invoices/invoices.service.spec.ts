import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
import { FieldPermissionsService } from '../field-permissions/field-permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: {
    client: { findFirst: jest.Mock };
    site: { findFirst: jest.Mock; findMany: jest.Mock };
    invoice: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    invoiceDispute: { findFirst: jest.Mock };
    rateCard: { findFirst: jest.Mock };
    timesheet: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let webhooksService: { triggerEvent: jest.Mock };
  let brandingService: { brandingSnapshot: jest.Mock; emailShell: jest.Mock; addPdfHeader: jest.Mock };
  let fieldPermissionsService: { filterFieldsByPermission: jest.Mock };

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const activeUser = { sub: userId, tenantId, role: 'admin' } as any;
  const clientId = 'client-1';
  const siteId = 'site-1';

  const dto: GenerateInvoiceDto = {
    client_id: clientId,
    site_id: siteId,
    billing_start_date: '2026-05-01',
    billing_end_date: '2026-05-15',
  };

  const client = {
    id: clientId,
    name: 'Acme',
    companyName: 'Acme Security',
    email: 'client@example.com',
    phone: null,
  };

  const site = {
    id: siteId,
    name: 'Warehouse',
    address: '100 Main St',
    clientId,
  };

  const rateCard = {
    id: 'rate-1',
    roleName: 'Guard',
    hourlyRate: 30.555,
    overtimeRate: null,
    holidayRate: null,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    status: 'active',
    clientId,
    siteId,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const baseInvoice = {
    id: 'invoice-1',
    tenantId,
    clientId,
    siteId,
    invoiceNumber: 'INV-20260529-0001',
    billingStartDate: new Date('2026-05-01T00:00:00.000Z'),
    billingEndDate: new Date('2026-05-15T00:00:00.000Z'),
    totalHours: 12.4,
    hourlyRate: 30.56,
    subtotal: 378.94,
    tax: 0,
    totalAmount: 378.94,
    status: 'draft',
    createdAt: new Date('2026-05-29T00:00:00.000Z'),
    issuedAt: null,
    paidAt: null,
    dueDate: null,
    rateCardId: rateCard.id,
    rateSource: 'site_rate_card',
    client,
    site,
    rateCard: {
      id: rateCard.id,
      roleName: rateCard.roleName,
      hourlyRate: rateCard.hourlyRate,
      overtimeRate: rateCard.overtimeRate,
      holidayRate: rateCard.holidayRate,
      effectiveFrom: rateCard.effectiveFrom,
      effectiveTo: rateCard.effectiveTo,
      status: rateCard.status,
      clientId: rateCard.clientId,
      siteId: rateCard.siteId,
    },
    items: [
      {
        id: 'item-1',
        invoiceId: 'invoice-1',
        timesheetId: 'timesheet-1',
        rateCardId: rateCard.id,
        shiftId: 'shift-1',
        guardId: 'guard-1',
        workedHours: 4.2,
        hourlyRate: 30.56,
        amount: 128.35,
        shift: {
          id: 'shift-1',
          startTime: new Date('2026-05-03T08:00:00.000Z'),
          endTime: new Date('2026-05-03T12:00:00.000Z'),
          status: 'completed',
        },
        guard: {
          id: 'guard-1',
          name: 'Jane Guard',
          email: 'jane@example.com',
          phone: null,
        },
        rateCard: {
          id: rateCard.id,
          roleName: rateCard.roleName,
          hourlyRate: rateCard.hourlyRate,
          siteId: rateCard.siteId,
        },
      },
      {
        id: 'item-2',
        invoiceId: 'invoice-1',
        timesheetId: 'timesheet-2',
        rateCardId: rateCard.id,
        shiftId: 'shift-2',
        guardId: 'guard-2',
        workedHours: 8.2,
        hourlyRate: 30.56,
        amount: 250.59,
        shift: {
          id: 'shift-2',
          startTime: new Date('2026-05-04T08:00:00.000Z'),
          endTime: new Date('2026-05-04T16:00:00.000Z'),
          status: 'completed',
        },
        guard: {
          id: 'guard-2',
          name: 'Sam Guard',
          email: 'sam@example.com',
          phone: null,
        },
        rateCard: {
          id: rateCard.id,
          roleName: rateCard.roleName,
          hourlyRate: rateCard.hourlyRate,
          siteId: rateCard.siteId,
        },
      },
    ],
    disputes: [],
  };

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn() },
      site: { findFirst: jest.fn(), findMany: jest.fn() },
      invoice: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      invoiceDispute: { findFirst: jest.fn() },
      rateCard: { findFirst: jest.fn() },
      timesheet: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    webhooksService = { triggerEvent: jest.fn().mockResolvedValue(undefined) };
    brandingService = {
      brandingSnapshot: jest.fn().mockResolvedValue({
        company_name: 'Acme Security',
        support_email: 'support@example.com',
        primary_color: '#111827',
        secondary_color: '#4b5563',
      }),
      emailShell: jest.fn((_branding, _title, body) => body),
      addPdfHeader: jest.fn((doc, title) => {
        doc.fontSize(18).text(title);
      }),
    };
    fieldPermissionsService = {
      filterFieldsByPermission: jest.fn(async (_user, _entity, data) => data),
    };
    service = new InvoicesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      webhooksService as unknown as WebhooksService,
      brandingService as unknown as BrandingService,
      fieldPermissionsService as unknown as FieldPermissionsService,
    );
  });

  function mockBillableClientAndSite() {
    prisma.client.findFirst.mockResolvedValue(client);
    prisma.site.findFirst.mockResolvedValue(site);
    prisma.invoice.findFirst.mockResolvedValue(null);
  }

  function mockApprovedTimesheets() {
    prisma.timesheet.findMany.mockResolvedValue([
      {
        id: 'timesheet-1',
        shiftId: 'shift-1',
        guardId: 'guard-1',
        totalHours: 4.24,
        shift: {
          id: 'shift-1',
          startTime: new Date('2026-05-03T08:00:00.000Z'),
        },
        guard: {
          id: 'guard-1',
          name: 'Jane Guard',
        },
      },
      {
        id: 'timesheet-2',
        shiftId: 'shift-2',
        guardId: 'guard-2',
        totalHours: 8.16,
        shift: {
          id: 'shift-2',
          startTime: new Date('2026-05-04T08:00:00.000Z'),
        },
        guard: {
          id: 'guard-2',
          name: 'Sam Guard',
        },
      },
    ]);
  }

  function mockInvoiceCreateTransaction(invoice = baseInvoice) {
    const tx = {
      invoice: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(invoice),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx));
    return tx;
  }

  it('generates an invoice from approved timesheets in the billing period', async () => {
    mockBillableClientAndSite();
    prisma.rateCard.findFirst.mockResolvedValue(rateCard);
    mockApprovedTimesheets();
    const tx = mockInvoiceCreateTransaction();

    const invoice = await service.generateInvoice(activeUser, dto);

    expect(prisma.timesheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          siteId,
          status: 'approved',
          checkInTime: expect.objectContaining({
            gte: new Date('2026-05-01T00:00:00.000Z'),
            lt: new Date('2026-05-16T00:00:00.000Z'),
          }),
        }),
      }),
    );
    expect(invoice.invoiceNumber).toBe(baseInvoice.invoiceNumber);
    expect(invoice.items).toHaveLength(2);
    expect(tx.invoice.create).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVOICE_GENERATED' }));
  });

  it('explains when approved timesheets exist but have zero billable hours', async () => {
    mockBillableClientAndSite();
    prisma.rateCard.findFirst.mockResolvedValue(rateCard);
    prisma.timesheet.findMany.mockResolvedValue([
      {
        id: 'timesheet-zero',
        shiftId: 'shift-1',
        guardId: 'guard-1',
        totalHours: 0,
        shift: {
          id: 'shift-1',
          startTime: new Date('2026-05-03T08:00:00.000Z'),
        },
        guard: {
          id: 'guard-1',
          name: 'Jane Guard',
        },
      },
    ]);

    await expect(service.generateInvoice(activeUser, dto)).rejects.toThrow(
      'Approved timesheets found for this billing period, but they have 0 billable hours. Correct the timesheet hours before generating an invoice.',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invoice generation when there are no approved timesheets', async () => {
    mockBillableClientAndSite();
    prisma.rateCard.findFirst.mockResolvedValue(rateCard);
    prisma.timesheet.findMany.mockResolvedValue([]);

    await expect(service.generateInvoice(activeUser, dto)).rejects.toThrow(BadRequestException);
    await expect(service.generateInvoice(activeUser, dto)).rejects.toThrow(
      'No approved timesheets found for this billing period',
    );
  });

  it('rejects generation when no active rate card exists and manual fallback is disabled', async () => {
    mockBillableClientAndSite();
    prisma.rateCard.findFirst.mockResolvedValue(null);

    await expect(service.generateInvoice(activeUser, dto)).rejects.toThrow(BadRequestException);
    expect(prisma.timesheet.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid billing date ranges before querying invoice data', async () => {
    await expect(
      service.generateInvoice(activeUser, {
        ...dto,
        billing_start_date: '2026-05-15',
        billing_end_date: '2026-05-01',
      }),
    ).rejects.toThrow('billing_end_date must be on or after billing_start_date');

    expect(prisma.client.findFirst).not.toHaveBeenCalled();
  });

  it('calculates invoice hours, line items, subtotal, tax, and total amount', async () => {
    mockBillableClientAndSite();
    prisma.rateCard.findFirst.mockResolvedValue(rateCard);
    mockApprovedTimesheets();
    const tx = mockInvoiceCreateTransaction();

    await service.generateInvoice(activeUser, dto);

    expect(tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalHours: 12.4,
          hourlyRate: 30.56,
          subtotal: 378.94,
          tax: 0,
          totalAmount: 378.94,
          items: {
            create: [
              expect.objectContaining({
                timesheetId: 'timesheet-1',
                workedHours: 4.2,
                hourlyRate: 30.56,
                amount: 128.35,
              }),
              expect.objectContaining({
                timesheetId: 'timesheet-2',
                workedHours: 8.2,
                hourlyRate: 30.56,
                amount: 250.59,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('uses the manual hourly rate when manual rate is enabled', async () => {
    mockBillableClientAndSite();
    mockApprovedTimesheets();
    const tx = mockInvoiceCreateTransaction({
      ...baseInvoice,
      hourlyRate: 100,
      rateCardId: null,
      rateSource: 'manual',
      subtotal: 1240,
      totalAmount: 1240,
    });

    await service.generateInvoice(activeUser, {
      ...dto,
      allow_manual_rate: true,
      hourly_rate: 100,
    });

    expect(prisma.rateCard.findFirst).not.toHaveBeenCalled();
    expect(tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hourlyRate: 100,
          rateCardId: null,
          rateSource: 'manual',
        }),
      }),
    );
  });

  it('rejects duplicate invoices for the same client, site, and billing period', async () => {
    prisma.client.findFirst.mockResolvedValue(client);
    prisma.site.findFirst.mockResolvedValue(site);
    prisma.invoice.findFirst.mockResolvedValue({ id: 'existing-invoice', invoiceNumber: 'INV-EXISTING' });

    await expect(service.generateInvoice(activeUser, dto)).rejects.toThrow(ConflictException);
    expect(prisma.rateCard.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires client context for client invoice access', async () => {
    await expect(service.findAllForClient(tenantId, '')).rejects.toThrow(ForbiddenException);
    await expect(service.findOneForClient(tenantId, '', 'invoice-1')).rejects.toThrow(ForbiddenException);
    await expect(service.downloadForClient(tenantId, '', 'client-user-1', 'invoice-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('restricts client invoice details to the owning client and visible statuses', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(service.findOneForClient(tenantId, 'other-client', 'invoice-1')).rejects.toThrow(NotFoundException);

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'invoice-1',
          tenantId,
          clientId: 'other-client',
          status: { in: ['issued', 'disputed', 'resolved', 'paid'] },
        },
      }),
    );
  });

  it('generates an invoice PDF buffer for admin export', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      status: 'issued',
      issuedAt: new Date('2026-05-16T00:00:00.000Z'),
    });

    const { buffer, invoice } = await service.exportForAdmin(activeUser, 'invoice-1');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(invoice.invoiceNumber).toBe(baseInvoice.invoiceNumber);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVOICE_DOWNLOADED' }));
  });
});
