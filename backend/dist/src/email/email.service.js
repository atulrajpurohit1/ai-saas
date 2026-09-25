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
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const branding_service_1 = require("../branding/branding.service");
const prisma_service_1 = require("../prisma/prisma.service");
function parseAddress(address) {
    const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(address);
    if (!match) {
        return { email: address.trim() };
    }
    const name = match[1].trim();
    return { ...(name ? { name } : {}), email: match[2].trim() };
}
class BrevoHttpTransport {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async sendMail(options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        let response;
        try {
            response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    sender: parseAddress(options.from),
                    to: [{ email: options.to }],
                    ...(options.replyTo
                        ? { replyTo: parseAddress(options.replyTo) }
                        : {}),
                    subject: options.subject,
                    textContent: options.text,
                    htmlContent: options.html,
                    ...(options.attachments?.length
                        ? {
                            attachment: options.attachments.map((file) => ({
                                name: file.filename,
                                content: file.content.toString('base64'),
                            })),
                        }
                        : {}),
                }),
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timeout);
        }
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Brevo API request failed (${response.status}): ${body || response.statusText}`);
        }
        const data = (await response.json());
        return { messageId: data.messageId || '' };
    }
}
class ResendHttpTransport {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async sendMail(options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        let response;
        try {
            response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: options.from,
                    to: options.to,
                    ...(options.replyTo ? { reply_to: options.replyTo } : {}),
                    subject: options.subject,
                    ...(options.attachments?.length
                        ? {
                            attachments: options.attachments.map((file) => ({
                                filename: file.filename,
                                content: file.content.toString('base64'),
                            })),
                        }
                        : {}),
                    text: options.text,
                    html: options.html,
                }),
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timeout);
        }
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Resend API request failed (${response.status}): ${body || response.statusText}`);
        }
        const data = (await response.json());
        return { messageId: data.id || '' };
    }
}
let EmailService = EmailService_1 = class EmailService {
    prisma;
    brandingService;
    logger = new common_1.Logger(EmailService_1.name);
    transporter;
    usingNodemailer = false;
    envelopeFrom = process.env.EMAIL_FROM || 'no-reply@aisaascrm.com';
    constructor(prisma, brandingService) {
        this.prisma = prisma;
        this.brandingService = brandingService;
        const brevoApiKey = process.env.BREVO_API_KEY;
        const resendApiKey = process.env.RESEND_API_KEY;
        if (brevoApiKey) {
            this.transporter = new BrevoHttpTransport(brevoApiKey);
        }
        else if (resendApiKey) {
            this.transporter = new ResendHttpTransport(resendApiKey);
        }
        else {
            const smtpPort = Number(process.env.SMTP_PORT) || 587;
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.ethereal.email',
                port: smtpPort,
                secure: smtpPort === 465,
                auth: {
                    user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
                    pass: process.env.SMTP_PASS || 'ethereal-pass',
                },
                connectionTimeout: 10_000,
                greetingTimeout: 10_000,
                socketTimeout: 15_000,
            });
            this.usingNodemailer = true;
        }
    }
    senderFor(companyName, supportEmail) {
        return {
            from: `"${companyName}" <${this.envelopeFrom}>`,
            ...(supportEmail ? { replyTo: supportEmail } : {}),
        };
    }
    previewUrlFor(info) {
        if (!this.usingNodemailer) {
            return false;
        }
        return nodemailer.getTestMessageUrl(info);
    }
    async sendDailyReportEmail(input) {
        const branding = await this.brandingService.brandingSnapshot(input.tenantId);
        const filename = `daily-report-${input.reportDate}.pdf`;
        const paragraphs = input.summary
            .split(/\n{2,}/)
            .map((block) => block.trim())
            .filter(Boolean);
        try {
            await this.transporter.sendMail({
                ...this.senderFor(branding.company_name, branding.support_email),
                to: input.to,
                subject: `Daily Service Report — ${input.siteName} — ${input.reportDate}`,
                text: `Daily Service Report\n${input.siteName} — ${input.reportDate}\n\n` +
                    `${input.summary}\n\n` +
                    `The full report is attached as a PDF.`,
                html: this.brandingService.emailShell(branding, 'Daily Service Report', `
          <p>Dear ${input.clientName},</p>
          <p>Please find below the service summary for
            <strong>${input.siteName}</strong> on
            <strong>${input.reportDate}</strong>.</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            ${paragraphs
                    .map((block) => `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #4b5563;">${block}</p>`)
                    .join('')}
          </div>
          <p style="font-size: 13px; color: #6b7280;">The full report is attached as a PDF.</p>
        `),
                attachments: [{ filename, content: input.pdf }],
            });
            return { sent: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown mail error';
            this.logger.error(`Daily report email to ${input.to} failed: ${message}`);
            return { sent: false, error: message };
        }
    }
    async sendProposalEmail(tenantId, leadId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, tenantId },
            include: {
                proposals: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!lead) {
            throw new common_1.NotFoundException(`Lead not found`);
        }
        if (!lead.email) {
            throw new common_1.BadRequestException(`Lead ${lead.name} does not have an email address`);
        }
        const proposal = lead.proposals[0];
        if (!proposal) {
            throw new common_1.BadRequestException(`Lead ${lead.name} does not have an associated proposal. Please generate one first.`);
        }
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        const info = await this.transporter.sendMail({
            ...this.senderFor(branding.company_name, branding.support_email),
            to: lead.email,
            subject: `Proposal: ${proposal.title} - ${lead.company}`,
            text: `Dear ${lead.name},\n\nPlease find your security proposal details below:\n\n${proposal.content}`,
            html: this.brandingService.emailShell(branding, 'Your Security Proposal', `
          <p>Dear ${lead.name},</p>
          <p>Thank you for choosing <strong>${branding.company_name}</strong>. We have generated a professional security proposal for <strong>${lead.company}</strong>.</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">${proposal.title}</h3>
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #4b5563;">
              ${proposal.content.replace(/\n/g, '<br/>')}
            </div>
          </div>
      `),
        });
        await this.prisma.proposal.update({
            where: { id: proposal.id },
            data: { status: 'sent' },
        });
        return {
            messageId: info.messageId,
            previewUrl: this.previewUrlFor(info),
            status: 'sent',
        };
    }
    async sendOtpEmail(tenantId, params) {
        const branding = tenantId
            ? await this.brandingService.brandingSnapshot(tenantId)
            : null;
        const companyName = branding?.company_name || 'AegisLead';
        const greetingName = params.name?.trim() || 'there';
        const info = await this.transporter.sendMail({
            ...this.senderFor(companyName, branding?.support_email),
            to: params.email,
            subject: `Your ${companyName} verification code`,
            text: `Your ${companyName} verification code is: ${params.code}\n\nThis code expires in ${params.expiresInMinutes} minutes.\n\nIf you did not request this verification, you can ignore this email.`,
            html: branding
                ? this.brandingService.emailShell(branding, 'Verify your email', this.otpEmailBody(companyName, greetingName, params.code, params.expiresInMinutes))
                : this.plainOtpEmailHtml(companyName, greetingName, params.code, params.expiresInMinutes),
        });
        return {
            messageId: info.messageId,
            previewUrl: this.previewUrlFor(info),
        };
    }
    async sendPasswordResetOtpEmail(tenantId, params) {
        const branding = tenantId
            ? await this.brandingService.brandingSnapshot(tenantId)
            : null;
        const companyName = branding?.company_name || 'AegisLead';
        const greetingName = params.name?.trim() || 'there';
        const info = await this.transporter.sendMail({
            ...this.senderFor(companyName, branding?.support_email),
            to: params.email,
            subject: `Your ${companyName} password reset code`,
            text: `We received a request to reset your ${companyName} password.\n\nYour verification code is: ${params.code}\n\nThis code expires in ${params.expiresInMinutes} minutes.\n\nIf you did not request a password reset, you can safely ignore this email.`,
            html: branding
                ? this.brandingService.emailShell(branding, 'Password Reset Request', this.passwordResetOtpEmailBody(companyName, greetingName, params.code, params.expiresInMinutes))
                : this.plainPasswordResetOtpEmailHtml(companyName, greetingName, params.code, params.expiresInMinutes),
        });
        return {
            messageId: info.messageId,
            previewUrl: this.previewUrlFor(info),
        };
    }
    passwordResetOtpEmailBody(companyName, greetingName, code, expiresInMinutes) {
        return `
      <p>Hi ${greetingName},</p>
      <p>We received a request to reset your <strong>${companyName}</strong> password. Use the verification code below to continue:</p>
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0; text-align: center;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${code}</span>
      </div>
      <p style="color: #4b5563;">This code expires in ${expiresInMinutes} minutes.</p>
      <p style="color: #6b7280; font-size: 13px;">If you did not request a password reset, you can safely ignore this email — your password will not be changed.</p>
    `;
    }
    plainPasswordResetOtpEmailHtml(companyName, greetingName, code, expiresInMinutes) {
        return `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #111827;">${this.passwordResetOtpEmailBody(companyName, greetingName, code, expiresInMinutes)}</body></html>`;
    }
    otpEmailBody(companyName, greetingName, code, expiresInMinutes) {
        return `
      <p>Hi ${greetingName},</p>
      <p>Use the verification code below to confirm your email address for <strong>${companyName}</strong>:</p>
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0; text-align: center;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${code}</span>
      </div>
      <p style="color: #4b5563;">This code expires in ${expiresInMinutes} minutes.</p>
      <p style="color: #6b7280; font-size: 13px;">If you did not request this verification, you can safely ignore this email.</p>
    `;
    }
    plainOtpEmailHtml(companyName, greetingName, code, expiresInMinutes) {
        return `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #111827;">${this.otpEmailBody(companyName, greetingName, code, expiresInMinutes)}</body></html>`;
    }
    async sendVendorInvitationEmail(tenantId, params) {
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        const deadlineText = params.dueDate
            ? params.dueDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })
            : 'Not specified';
        const info = await this.transporter.sendMail({
            ...this.senderFor(branding.company_name, branding.support_email),
            to: params.vendorEmail,
            subject: `Invitation to Submit a Proposal: ${params.rfpTitle}`,
            text: `Dear ${params.vendorCompanyName},\n\nYou have been invited to submit a proposal for "${params.rfpTitle}".\n\nSubmission deadline: ${deadlineText}\n\nUse this secure link to view the request and submit your proposal:\n${params.invitationUrl}`,
            html: this.brandingService.emailShell(branding, 'Invitation to Submit a Proposal', `
          <p>Dear ${params.vendorCompanyName},</p>
          <p>You have been invited by <strong>${branding.company_name}</strong> to submit a proposal for the following request:</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">${params.rfpTitle}</h3>
            <p style="color: #4b5563; margin: 0;"><strong>Submission deadline:</strong> ${deadlineText}</p>
          </div>
          <p style="margin: 24px 0;">
            <a href="${params.invitationUrl}" style="display:inline-block;background-color:${branding.primary_color || '#4f46e5'};color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;">
              View Request &amp; Submit Proposal
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">If the button does not work, copy and paste this link into your browser:<br/>${params.invitationUrl}</p>
        `),
        });
        return {
            messageId: info.messageId,
            previewUrl: this.previewUrlFor(info),
        };
    }
    async sendContractAwardEmail(tenantId, params) {
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        const info = await this.transporter.sendMail({
            ...this.senderFor(branding.company_name, branding.support_email),
            to: params.vendorEmail,
            subject: 'Congratulations - Contract Award',
            text: `Dear ${params.vendorCompanyName},\n\nCongratulations! Your proposal for "${params.rfpTitle}" has been selected and the contract has been awarded to your company.${params.awardNotes ? `\n\nNotes: ${params.awardNotes}` : ''}\n\nOur team will be in touch shortly with next steps.`,
            html: this.brandingService.emailShell(branding, 'Congratulations - Contract Award', `
          <p>Dear ${params.vendorCompanyName},</p>
          <p><strong>Congratulations!</strong> Your proposal for the following request has been selected, and ${branding.company_name} is pleased to award you the contract.</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">${params.rfpTitle}</h3>
            ${params.awardNotes ? `<p style="color: #4b5563; margin: 0;"><strong>Notes:</strong> ${params.awardNotes}</p>` : ''}
          </div>
          <p>Our team will be in touch shortly with next steps.</p>
        `),
        });
        return {
            messageId: info.messageId,
            previewUrl: this.previewUrlFor(info),
        };
    }
    async sendVendorRejectionEmail(tenantId, params) {
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        const info = await this.transporter.sendMail({
            ...this.senderFor(branding.company_name, branding.support_email),
            to: params.vendorEmail,
            subject: 'Thank you for participating',
            text: `Dear ${params.vendorCompanyName},\n\nThank you for submitting a proposal for "${params.rfpTitle}". After careful review, we have decided to move forward with another vendor at this time.${params.reason ? `\n\nFeedback: ${params.reason}` : ''}\n\nWe appreciate the time and effort you invested in your submission and hope to have the opportunity to work with you in the future.`,
            html: this.brandingService.emailShell(branding, 'Thank you for participating', `
          <p>Dear ${params.vendorCompanyName},</p>
          <p>Thank you for submitting a proposal for the following request. After careful review, ${branding.company_name} has decided to move forward with another vendor at this time.</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">${params.rfpTitle}</h3>
            ${params.reason ? `<p style="color: #4b5563; margin: 0;"><strong>Feedback:</strong> ${params.reason}</p>` : ''}
          </div>
          <p>We appreciate the time and effort you invested in your submission and hope to have the opportunity to work with you in the future.</p>
        `),
        });
        return {
            messageId: info.messageId,
            previewUrl: this.previewUrlFor(info),
        };
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        branding_service_1.BrandingService])
], EmailService);
//# sourceMappingURL=email.service.js.map