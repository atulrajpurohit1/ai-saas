import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalesDeliveryService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandingService: BrandingService,
    private readonly auditService: AuditService,
  ) {
    const hasSmtpConfig = Boolean(
      process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_USER !== 'your-ethereal-user' &&
        process.env.SMTP_PASS !== 'your-ethereal-pass',
    );

    this.transporter =
      hasSmtpConfig
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          })
        : nodemailer.createTransport({ jsonTransport: true });
  }

  async draftDealFollowUp(tenantId: string, dealId: string) {
    const deal = await this.getDealContext(tenantId, dealId);
    const assessment = deal.salesAssessments[0] || null;
    const discovery = deal.discoverySessions[0] || null;
    const nextActivity = this.nextActivity(deal.activities);
    const riskLine =
      assessment?.riskProfile ||
      discovery?.riskConcerns?.[0] ||
      'the security coverage risks we discussed';
    const valueLine =
      assessment?.proposalAngle ||
      'reduce site risk, improve accountability, and keep coverage visible to your team';

    return {
      dealId: deal.id,
      dealName: deal.name,
      to: deal.lead.email,
      contactName: deal.lead.name,
      company: deal.lead.company,
      subject: `Security follow-up for ${deal.lead.company}`,
      body: [
        `Hi ${deal.lead.name},`,
        '',
        `I wanted to follow up on ${riskLine}.`,
        `Based on the current scope, the main value is to ${valueLine}.`,
        '',
        nextActivity?.dueDate
          ? `Would it be useful to use our next checkpoint on ${nextActivity.dueDate.toDateString()} to confirm scope, timing, and any final objections?`
          : 'Would it be useful to schedule a short checkpoint to confirm scope, timing, and any final objections?',
        '',
        'Best regards,',
      ].join('\n'),
      nextActivity: nextActivity
        ? {
            id: nextActivity.id,
            subject: nextActivity.subject,
            dueDate: nextActivity.dueDate,
            description: nextActivity.description,
          }
        : null,
    };
  }

  async sendDealFollowUp(tenantId: string, dealId: string, userId?: string) {
    const draft = await this.draftDealFollowUp(tenantId, dealId);

    if (!draft.to) {
      throw new BadRequestException('This deal lead does not have an email address');
    }

    const branding = await this.brandingService.brandingSnapshot(tenantId);
    let info: nodemailer.SentMessageInfo;
    try {
      info = await this.transporter.sendMail({
        from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
        to: draft.to,
        subject: draft.subject,
        text: draft.body,
        html: this.brandingService.emailShell(
          branding,
          draft.subject,
          `<div style="white-space: pre-wrap; line-height: 1.6;">${this.escapeHtml(draft.body)}</div>`,
        ),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `Unable to send follow-up email. Check SMTP settings. ${
          error instanceof Error ? error.message : ''
        }`.trim(),
      );
    }

    const activity = await this.prisma.activity.create({
      data: {
        type: 'email',
        subject: draft.subject,
        description: `Sent follow-up email to ${draft.to}`,
        dueDate: new Date(),
        dealId,
        tenantId,
        status: 'completed',
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SEND',
      entityType: 'SALES_FOLLOW_UP_EMAIL',
      entityId: activity.id,
      details: `Sent deal follow-up email for ${draft.dealName}`,
    });

    return {
      status: 'sent',
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
      activityId: activity.id,
    };
  }

  async calendarForDeal(tenantId: string, dealId: string) {
    const deal = await this.getDealContext(tenantId, dealId);
    const activity = this.nextActivity(deal.activities);
    const start = activity?.dueDate || this.tomorrow();
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const subject = activity?.subject || `Follow up with ${deal.lead.company}`;
    const description =
      activity?.description ||
      `Sales follow-up for ${deal.name}. Confirm scope, risks, objections, and decision timeline.`;

    return {
      filename: `${this.slug(deal.lead.company)}-follow-up.ics`,
      content: [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Ai Saas//Sales Delivery//EN',
        'BEGIN:VEVENT',
        `UID:${deal.id}@ai-saas.local`,
        `DTSTAMP:${this.icsDate(new Date())}`,
        `DTSTART:${this.icsDate(start)}`,
        `DTEND:${this.icsDate(end)}`,
        `SUMMARY:${this.icsText(subject)}`,
        `DESCRIPTION:${this.icsText(description)}`,
        `LOCATION:${this.icsText(deal.lead.company)}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    };
  }

  private async getDealContext(tenantId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      include: {
        lead: true,
        activities: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 20,
        },
        discoverySessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        salesAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  private nextActivity(activities: Array<{ status: string; dueDate: Date | null } & Record<string, any>>) {
    const now = new Date();
    return (
      activities.find(
        (activity) =>
          activity.status !== 'completed' &&
          activity.dueDate &&
          activity.dueDate.getTime() >= now.getTime(),
      ) || null
    );
  }

  private tomorrow() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date;
  }

  private icsDate(date: Date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  private icsText(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  private slug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sales';
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
