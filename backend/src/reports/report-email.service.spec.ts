import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
import { EmailService } from '../email/email.service';
import { AiService } from '../ai/ai.service';
import { ReportsService } from './reports.service';

/**
 * Covers emailing a daily service report to the client.
 *
 * The behaviour that matters most here is what happens when something fails:
 * this runs inside publish, and a mail or AI problem must never undo a publish
 * that already succeeded.
 */
describe('ReportsService — client report email', () => {
  let service: ReportsService;
  let email: { sendDailyReportEmail: jest.Mock };
  let ai: { generateDailyReportSummary: jest.Mock };
  let audit: { log: jest.Mock };

  const report = (overrides: Record<string, unknown> = {}) => ({
    id: 'report-1',
    tenantId: 'tenant-1',
    reportDate: new Date('2026-09-26T00:00:00Z'),
    status: 'published',
    summary: JSON.stringify({
      totals: {
        shifts: 2,
        assignedGuards: 3,
        completedAttendances: 4,
        checkedInAttendances: 12,
        missedAttendances: 0,
        totalWorkedHours: 16,
        approvedIncidents: 1,
      },
      incidents: [{ title: 'Unsecured side gate', severity: 'low' }],
    }),
    site: { id: 'site-1', name: 'Northgate Depot' },
    client: {
      id: 'client-1',
      name: 'Marcus Webb',
      companyName: 'Northgate Logistics',
      email: 'ops@northgate-log.com',
      reportEmailEnabled: true,
      reportEmailMode: 'MANUAL',
      reportEmailCc: null,
    },
    ...overrides,
  });

  beforeEach(async () => {
    email = {
      sendDailyReportEmail: jest.fn().mockResolvedValue({ sent: true }),
    };
    ai = {
      generateDailyReportSummary: jest
        .fn()
        .mockResolvedValue('The site was covered as contracted.'),
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditService, useValue: audit },
        {
          provide: BrandingService,
          useValue: {
            brandingSnapshot: jest.fn().mockResolvedValue({
              company_name: 'Sentinel',
              support_email: 'ops@sentinel.test',
            }),
          },
        },
        { provide: EmailService, useValue: email },
        { provide: AiService, useValue: ai },
      ],
    }).compile();

    service = moduleRef.get(ReportsService);
    // The PDF builder needs pdfkit and a real branding lookup; neither is what
    // these tests are about.
    jest
      .spyOn(
        service as unknown as { buildPdfBuffer: () => Promise<Buffer> },
        'buildPdfBuffer',
      )
      .mockResolvedValue(Buffer.from('%PDF-1.4 fake'));
  });

  it('emails the client with an AI summary and the PDF attached', async () => {
    const result = await service.deliverReportByEmail(report(), 'publish');

    expect(result).toEqual({ sent: true });
    expect(email.sendDailyReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@northgate-log.com',
        clientName: 'Northgate Logistics',
        siteName: 'Northgate Depot',
        summary: 'The site was covered as contracted.',
        pdf: expect.any(Buffer),
      }),
    );
  });

  it('feeds the recorded activity into the AI summary', async () => {
    await service.deliverReportByEmail(report(), 'publish');

    expect(ai.generateDailyReportSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        shiftsCovered: 2,
        patrolsCompleted: 4,
        checkpointsScanned: 12,
        incidents: [{ title: 'Unsecured side gate', severity: 'low' }],
      }),
    );
  });

  // Emailing a client who never asked for it is worse than them not getting it.
  it('sends nothing when the client has not opted in', async () => {
    const result = await service.deliverReportByEmail(
      report({
        client: { ...report().client, reportEmailEnabled: false },
      }),
      'publish',
    );

    expect(result).toEqual({ sent: false, skipped: 'disabled' });
    expect(email.sendDailyReportEmail).not.toHaveBeenCalled();
  });

  it('skips a client with no email address', async () => {
    const result = await service.deliverReportByEmail(
      report({ client: { ...report().client, email: null } }),
      'publish',
    );

    expect(result).toEqual({ sent: false, skipped: 'no-client-email' });
    expect(email.sendDailyReportEmail).not.toHaveBeenCalled();
  });

  // AI being unavailable is not a reason to withhold the report.
  it('still sends when the AI summary fails', async () => {
    ai.generateDailyReportSummary.mockRejectedValue(new Error('gemini down'));

    const result = await service.deliverReportByEmail(report(), 'publish');

    expect(result).toEqual({ sent: true });
    const sent = email.sendDailyReportEmail.mock.calls[0][0] as {
      summary: string;
    };
    expect(sent.summary).toContain('Northgate Depot');
  });

  // A mail failure must not roll back a publish that already happened.
  it('reports a delivery failure without throwing', async () => {
    email.sendDailyReportEmail.mockResolvedValue({
      sent: false,
      error: 'mailbox full',
    });

    await expect(
      service.deliverReportByEmail(report(), 'publish'),
    ).resolves.toEqual({ sent: false, error: 'mailbox full' });
  });

  it('audits both success and failure', async () => {
    await service.deliverReportByEmail(report(), 'publish');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DAILY_REPORT_EMAILED' }),
    );

    audit.log.mockClear();
    email.sendDailyReportEmail.mockResolvedValue({
      sent: false,
      error: 'bounced',
    });
    await service.deliverReportByEmail(report(), 'publish');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DAILY_REPORT_EMAIL_FAILED' }),
    );
  });

  // An audit write failing must not lose the email result.
  it('survives an audit log failure', async () => {
    audit.log.mockRejectedValue(new Error('audit down'));

    await expect(
      service.deliverReportByEmail(report(), 'publish'),
    ).resolves.toEqual({ sent: true });
  });

  it('falls back to the client contact name when there is no company', async () => {
    await service.deliverReportByEmail(
      report({ client: { ...report().client, companyName: null } }),
      'publish',
    );

    expect(email.sendDailyReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Marcus Webb' }),
    );
  });
});
