import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BrandingService } from '../branding/branding.service';
import { branchScopedWhere, branchWhere } from '../branches/branch-scope';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateDailyReportDto } from './dto/generate-daily-report.dto';

type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';

type AttendanceEventSummary = {
  guardId: string;
  type: string;
  timestamp: Date;
};

type GuardReportSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  assignmentStatus: string;
  attendanceStatus: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalWorkedHours: number;
};

type ShiftReportSummary = {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  assignedGuards: GuardReportSummary[];
};

type IncidentReportSummary = {
  id: string;
  title: string;
  description: string;
  severity: string;
  occurredAt: string;
  attachmentUrl: string | null;
  guard: {
    id: string;
    name: string;
  };
  shift: {
    id: string;
    startTime: string;
    endTime: string;
  };
};

type DailyReportSummary = {
  reportDate: string;
  site: {
    id: string;
    name: string;
    address: string;
    instructions: string | null;
  };
  client: {
    id: string;
    name: string;
    companyName: string | null;
  };
  totals: {
    shifts: number;
    assignedGuards: number;
    completedAttendances: number;
    checkedInAttendances: number;
    missedAttendances: number;
    totalWorkedHours: number;
    approvedIncidents: number;
  };
  shifts: ShiftReportSummary[];
  incidents: IncidentReportSummary[];
};

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private brandingService: BrandingService,
  ) {}

  private parseReportDate(value: string) {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException('report_date is required');
    }

    let reportDate: Date;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      reportDate = new Date(Date.UTC(year, month - 1, day));

      if (
        reportDate.getUTCFullYear() !== year ||
        reportDate.getUTCMonth() !== month - 1 ||
        reportDate.getUTCDate() !== day
      ) {
        throw new BadRequestException('report_date must be a valid date');
      }
    } else {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('report_date must be a valid date');
      }

      reportDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
    }

    const nextDate = new Date(reportDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    return { reportDate, nextDate };
  }

  private summarizeAttendance(events: AttendanceEventSummary[]) {
    const checkIn = events.find((event) => event.type === 'CHECK_IN');
    const checkOut = events.find((event) => event.type === 'CHECK_OUT');
    const totalWorkedHours =
      checkIn && checkOut
        ? Math.max(0, Math.round(((checkOut.timestamp.getTime() - checkIn.timestamp.getTime()) / 3_600_000) * 10) / 10)
        : 0;

    return {
      attendanceStatus: checkOut ? 'completed' : checkIn ? 'checked_in' : 'not_started',
      checkInTime: checkIn?.timestamp.toISOString() ?? null,
      checkOutTime: checkOut?.timestamp.toISOString() ?? null,
      totalWorkedHours,
    } satisfies {
      attendanceStatus: AttendanceStatus;
      checkInTime: string | null;
      checkOutTime: string | null;
      totalWorkedHours: number;
    };
  }

  private parseStoredSummary(summary: string): DailyReportSummary | { raw: string } {
    try {
      const parsed = JSON.parse(summary);
      if (parsed && typeof parsed === 'object') {
        return parsed as DailyReportSummary;
      }
    } catch {
      // Fall through to preserve legacy/plain text summaries.
    }

    return { raw: summary };
  }

  private mapReport(report: any) {
    return {
      id: report.id,
      tenantId: report.tenantId,
      clientId: report.clientId,
      siteId: report.siteId,
      branchId: report.branchId,
      reportDate: report.reportDate,
      status: report.status,
      createdAt: report.createdAt,
      publishedAt: report.publishedAt,
      summary: this.parseStoredSummary(report.summary),
      client: report.client
        ? {
            id: report.client.id,
            name: report.client.name,
            companyName: report.client.companyName,
            email: report.client.email,
          }
        : null,
      site: report.site
        ? {
            id: report.site.id,
            name: report.site.name,
            address: report.site.address,
          }
        : null,
    };
  }

  private reportInclude() {
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
      branch: {
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
        },
      },
    };
  }

  private async findReportOrThrow(user: ActiveUser, id: string) {
    const report = await this.prisma.dailyServiceReport.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
      include: this.reportInclude(),
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  private async findClientReportOrThrow(tenantId: string, clientId: string, id: string) {
    const report = await this.prisma.dailyServiceReport.findFirst({
      where: {
        id,
        tenantId,
        clientId,
        status: 'published',
        site: { clientId },
      },
      include: this.reportInclude(),
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  private buildDailySummary(input: {
    site: {
      id: string;
      name: string;
      address: string;
      instructions: string | null;
      client: {
        id: string;
        name: string;
        companyName: string | null;
      };
    };
    reportDate: Date;
    shifts: any[];
    incidents: any[];
  }): DailyReportSummary {
    const shiftSummaries: ShiftReportSummary[] = input.shifts.map((shift) => {
      const assignedGuards = shift.assignments.map((assignment) => {
        const guardEvents = shift.attendanceEvents.filter(
          (event: AttendanceEventSummary) => event.guardId === assignment.guardId,
        );
        const attendance = this.summarizeAttendance(guardEvents);

        return {
          id: assignment.guard.id,
          name: assignment.guard.name,
          email: assignment.guard.email,
          phone: assignment.guard.phone,
          assignmentStatus: assignment.status,
          attendanceStatus: attendance.attendanceStatus,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
          totalWorkedHours: attendance.totalWorkedHours,
        };
      });

      return {
        id: shift.id,
        status: shift.status,
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime.toISOString(),
        assignedGuards,
      };
    });

    const allGuards = shiftSummaries.flatMap((shift) => shift.assignedGuards);

    return {
      reportDate: input.reportDate.toISOString().slice(0, 10),
      site: {
        id: input.site.id,
        name: input.site.name,
        address: input.site.address,
        instructions: input.site.instructions,
      },
      client: {
        id: input.site.client.id,
        name: input.site.client.name,
        companyName: input.site.client.companyName,
      },
      totals: {
        shifts: shiftSummaries.length,
        assignedGuards: allGuards.length,
        completedAttendances: allGuards.filter((guard) => guard.attendanceStatus === 'completed').length,
        checkedInAttendances: allGuards.filter((guard) => guard.attendanceStatus === 'checked_in').length,
        missedAttendances: allGuards.filter((guard) => guard.attendanceStatus === 'not_started').length,
        totalWorkedHours: Math.round(allGuards.reduce((sum, guard) => sum + guard.totalWorkedHours, 0) * 10) / 10,
        approvedIncidents: input.incidents.length,
      },
      shifts: shiftSummaries,
      incidents: input.incidents.map((incident) => ({
        id: incident.id,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        occurredAt: incident.occurredAt.toISOString(),
        attachmentUrl: incident.attachmentUrl,
        guard: {
          id: incident.guard.id,
          name: incident.guard.name,
        },
        shift: {
          id: incident.shift.id,
          startTime: incident.shift.startTime.toISOString(),
          endTime: incident.shift.endTime.toISOString(),
        },
      })),
    };
  }

  private formatDate(value: Date | string | null | undefined) {
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

  private addPdfSectionTitle(doc: any, title: string) {
    doc.moveDown(0.8);
    doc.fontSize(15).fillColor('#111827').text(title);
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.5);
  }

  private async buildPdfBuffer(report: any): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks: Buffer[] = [];
    const summary = this.parseStoredSummary(report.summary);
    const branding = await this.brandingService.brandingSnapshot(report.tenantId);

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.brandingService.addPdfHeader(doc, 'Daily Service Report', branding);
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor(branding.secondary_color).text(`Report date: ${this.formatDate(report.reportDate)}`, {
        align: 'right',
      });
      doc.moveDown();

      doc.fontSize(12).fillColor('#111827').text(`Client: ${report.client.companyName || report.client.name}`);
      doc.text(`Site: ${report.site.name}`);
      doc.text(`Address: ${report.site.address}`);
      doc.text(`Status: ${report.status}`);
      if (report.publishedAt) {
        doc.text(`Published: ${this.formatDate(report.publishedAt)}`);
      }

      if ('raw' in summary) {
        this.addPdfSectionTitle(doc, 'Summary');
        doc.fontSize(11).fillColor('#374151').text(summary.raw, { lineGap: 4 });
        doc.end();
        return;
      }

      this.addPdfSectionTitle(doc, 'Totals');
      doc.fontSize(11).fillColor('#374151');
      doc.text(`Shifts: ${summary.totals.shifts}`);
      doc.text(`Assigned guards: ${summary.totals.assignedGuards}`);
      doc.text(`Completed attendance records: ${summary.totals.completedAttendances}`);
      doc.text(`Missed attendance records: ${summary.totals.missedAttendances}`);
      doc.text(`Total worked hours: ${summary.totals.totalWorkedHours}`);
      doc.text(`Approved incidents: ${summary.totals.approvedIncidents}`);

      this.addPdfSectionTitle(doc, 'Shifts And Attendance');
      if (summary.shifts.length === 0) {
        doc.fontSize(11).fillColor('#6b7280').text('No shifts were scheduled for this date.');
      } else {
        summary.shifts.forEach((shift, index) => {
          doc.fontSize(12).fillColor('#111827').text(
            `${index + 1}. ${this.formatDate(shift.startTime)} to ${this.formatDate(shift.endTime)} (${shift.status})`,
          );

          if (shift.assignedGuards.length === 0) {
            doc.fontSize(10).fillColor('#6b7280').text('No assigned guards.');
          } else {
            shift.assignedGuards.forEach((guard) => {
              doc.fontSize(10).fillColor('#374151').text(
                `- ${guard.name}: ${guard.attendanceStatus}, in ${this.formatDate(guard.checkInTime)}, out ${this.formatDate(guard.checkOutTime)}, ${guard.totalWorkedHours}h`,
              );
            });
          }
          doc.moveDown(0.4);
        });
      }

      this.addPdfSectionTitle(doc, 'Approved Incidents');
      if (summary.incidents.length === 0) {
        doc.fontSize(11).fillColor('#6b7280').text('No approved incidents for this date.');
      } else {
        summary.incidents.forEach((incident, index) => {
          doc.fontSize(12).fillColor('#111827').text(`${index + 1}. ${incident.title} (${incident.severity})`);
          doc.fontSize(10).fillColor('#374151').text(`Occurred: ${this.formatDate(incident.occurredAt)}`);
          doc.fontSize(10).fillColor('#374151').text(`Guard: ${incident.guard.name}`);
          doc.fontSize(10).fillColor('#374151').text(incident.description, { lineGap: 3 });
          if (incident.attachmentUrl) {
            doc.fontSize(10).fillColor('#2563eb').text(`Attachment: ${incident.attachmentUrl}`);
          }
          doc.moveDown(0.5);
        });
      }

      doc.end();
    });
  }

  async generateDailyReport(user: ActiveUser, dto: GenerateDailyReportDto) {
    const siteId = dto.site_id?.trim();
    if (!siteId) {
      throw new BadRequestException('site_id is required');
    }

    const { reportDate, nextDate } = this.parseReportDate(dto.report_date);

    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId: user.tenantId, ...branchWhere(user) },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    if (!site.clientId || !site.client) {
      throw new BadRequestException('Site must be linked to a client before generating a report');
    }

    const shifts = await this.prisma.shift.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: site.branchId,
        siteId: site.id,
        startTime: { lt: nextDate },
        endTime: { gt: reportDate },
      },
      include: {
        assignments: {
          include: {
            guard: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attendanceEvents: {
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const incidents = await this.prisma.incident.findMany({
      where: {
        tenantId: user.tenantId,
        siteId: site.id,
        status: 'approved',
        occurredAt: {
          gte: reportDate,
          lt: nextDate,
        },
      },
      include: {
        guard: {
          select: {
            id: true,
            name: true,
          },
        },
        shift: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: { occurredAt: 'asc' },
    });

    const summary = this.buildDailySummary({
      site: {
        id: site.id,
        name: site.name,
        address: site.address,
        instructions: site.instructions,
        client: site.client,
      },
      reportDate,
      shifts,
      incidents,
    });

    const report = await this.prisma.dailyServiceReport.create({
      data: {
        tenantId: user.tenantId,
        clientId: site.clientId,
        siteId: site.id,
        reportDate,
        summary: JSON.stringify(summary),
        status: 'draft',
      },
      include: this.reportInclude(),
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DAILY_REPORT_GENERATED',
      entityType: 'DailyServiceReport',
      entityId: report.id,
      details: `Daily report generated for site "${site.name}" on ${summary.reportDate}`,
    });

    return this.mapReport(report);
  }

  async findAllForAdmin(user: ActiveUser, requestedBranchId?: string | null) {
    const reports = await this.prisma.dailyServiceReport.findMany({
      where: branchScopedWhere(user, requestedBranchId),
      include: this.reportInclude(),
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
    });

    return reports.map((report) => this.mapReport(report));
  }

  async findOneForAdmin(user: ActiveUser, id: string) {
    const report = await this.findReportOrThrow(user, id);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DAILY_REPORT_VIEWED',
      entityType: 'DailyServiceReport',
      entityId: report.id,
      details: `Admin viewed daily report "${report.id}"`,
    });

    return this.mapReport(report);
  }

  async publishReport(user: ActiveUser, id: string) {
    const existing = await this.findReportOrThrow(user, id);

    if (existing.status === 'published') {
      return this.mapReport(existing);
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft reports can be published');
    }

    const updated = await this.prisma.dailyServiceReport.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
      include: this.reportInclude(),
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DAILY_REPORT_PUBLISHED',
      entityType: 'DailyServiceReport',
      entityId: updated.id,
      details: `Daily report published for client "${updated.client.companyName || updated.client.name}"`,
    });

    return this.mapReport(updated);
  }

  async exportForAdmin(user: ActiveUser, id: string) {
    const report = await this.findReportOrThrow(user, id);
    const buffer = await this.buildPdfBuffer(report);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DAILY_REPORT_EXPORTED_PDF',
      entityType: 'DailyServiceReport',
      entityId: report.id,
      details: 'Admin exported daily report PDF',
    });

    return { buffer, report: this.mapReport(report) };
  }

  async findAllForClient(tenantId: string, clientId: string, userId: string) {
    if (!clientId) {
      throw new ForbiddenException('Client access required');
    }

    const reports = await this.prisma.dailyServiceReport.findMany({
      where: {
        tenantId,
        clientId,
        status: 'published',
        site: { clientId },
      },
      include: this.reportInclude(),
      orderBy: [{ reportDate: 'desc' }, { publishedAt: 'desc' }],
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_REPORT_LIST_VIEWED',
      entityType: 'DailyServiceReport',
      details: 'Client viewed published daily reports',
    });

    return reports.map((report) => this.mapReport(report));
  }

  async findOneForClient(tenantId: string, clientId: string, userId: string, id: string) {
    if (!clientId) {
      throw new ForbiddenException('Client access required');
    }

    const report = await this.findClientReportOrThrow(tenantId, clientId, id);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_REPORT_DETAIL_VIEWED',
      entityType: 'DailyServiceReport',
      entityId: report.id,
      details: 'Client viewed daily report detail',
    });

    return this.mapReport(report);
  }

  async downloadForClient(tenantId: string, clientId: string, userId: string, id: string) {
    if (!clientId) {
      throw new ForbiddenException('Client access required');
    }

    const report = await this.findClientReportOrThrow(tenantId, clientId, id);
    const buffer = await this.buildPdfBuffer(report);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_REPORT_DOWNLOADED',
      entityType: 'DailyServiceReport',
      entityId: report.id,
      details: 'Client downloaded daily report PDF',
    });

    return { buffer, report: this.mapReport(report) };
  }
}
