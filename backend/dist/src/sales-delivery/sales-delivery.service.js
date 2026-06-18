"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesDeliveryService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const audit_service_1 = require("../audit/audit.service");
const branding_service_1 = require("../branding/branding.service");
const prisma_service_1 = require("../prisma/prisma.service");
let SalesDeliveryService = class SalesDeliveryService {
    prisma;
    brandingService;
    auditService;
    transporter;
    constructor(prisma, brandingService, auditService) {
        this.prisma = prisma;
        this.brandingService = brandingService;
        this.auditService = auditService;
        const hasSmtpConfig = Boolean(process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS &&
            process.env.SMTP_USER !== 'your-ethereal-user' &&
            process.env.SMTP_PASS !== 'your-ethereal-pass');
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
    async draftDealFollowUp(tenantId, dealId) {
        const deal = await this.getDealContext(tenantId, dealId);
        const assessment = deal.salesAssessments[0] || null;
        const discovery = deal.discoverySessions[0] || null;
        const nextActivity = this.nextActivity(deal.activities);
        const riskLine = assessment?.riskProfile ||
            discovery?.riskConcerns?.[0] ||
            'the security coverage risks we discussed';
        const valueLine = assessment?.proposalAngle ||
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
    async sendDealFollowUp(tenantId, dealId, userId) {
        const draft = await this.draftDealFollowUp(tenantId, dealId);
        if (!draft.to) {
            throw new common_1.BadRequestException('This deal lead does not have an email address');
        }
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        let info;
        try {
            info = await this.transporter.sendMail({
                from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
                to: draft.to,
                subject: draft.subject,
                text: draft.body,
                html: this.brandingService.emailShell(branding, draft.subject, `<div style="white-space: pre-wrap; line-height: 1.6;">${this.escapeHtml(draft.body)}</div>`),
            });
        }
        catch (error) {
            throw new common_1.ServiceUnavailableException(`Unable to send follow-up email. Check SMTP settings. ${error instanceof Error ? error.message : ''}`.trim());
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
    async calendarForDeal(tenantId, dealId) {
        const deal = await this.getDealContext(tenantId, dealId);
        const activity = this.nextActivity(deal.activities);
        const start = activity?.dueDate || this.tomorrow();
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const subject = activity?.subject || `Follow up with ${deal.lead.company}`;
        const description = activity?.description ||
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
    async getDealContext(tenantId, dealId) {
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
        if (!deal)
            throw new common_1.NotFoundException('Deal not found');
        return deal;
    }
    nextActivity(activities) {
        const now = new Date();
        return (activities.find((activity) => activity.status !== 'completed' &&
            activity.dueDate &&
            activity.dueDate.getTime() >= now.getTime()) || null);
    }
    tomorrow() {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
        return date;
    }
    icsDate(date) {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    }
    icsText(value) {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');
    }
    slug(value) {
        return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sales';
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};
exports.SalesDeliveryService = SalesDeliveryService;
exports.SalesDeliveryService = SalesDeliveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        branding_service_1.BrandingService,
        audit_service_1.AuditService])
], SalesDeliveryService);
//# sourceMappingURL=sales-delivery.service.js.map