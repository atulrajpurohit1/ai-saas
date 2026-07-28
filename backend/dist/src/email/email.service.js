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
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const branding_service_1 = require("../branding/branding.service");
const prisma_service_1 = require("../prisma/prisma.service");
let EmailService = class EmailService {
    prisma;
    brandingService;
    transporter;
    constructor(prisma, brandingService) {
        this.prisma = prisma;
        this.brandingService = brandingService;
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: Number(process.env.SMTP_PORT) || 587,
            auth: {
                user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
                pass: process.env.SMTP_PASS || 'ethereal-pass',
            },
        });
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
            from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
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
            previewUrl: nodemailer.getTestMessageUrl(info),
            status: 'sent',
        };
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
            from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
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
            previewUrl: nodemailer.getTestMessageUrl(info),
        };
    }
    async sendContractAwardEmail(tenantId, params) {
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        const info = await this.transporter.sendMail({
            from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
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
            previewUrl: nodemailer.getTestMessageUrl(info),
        };
    }
    async sendVendorRejectionEmail(tenantId, params) {
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        const info = await this.transporter.sendMail({
            from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
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
            previewUrl: nodemailer.getTestMessageUrl(info),
        };
    }
    async sendBulkProposalEmails(tenantId) {
        let sentCount = 0;
        let skippedMissingEmail = 0;
        let skippedMissingProposal = 0;
        const results = [];
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        const allLeads = await this.prisma.lead.findMany({
            where: { tenantId },
            include: { proposals: true },
        });
        for (const lead of allLeads) {
            if (!lead.email) {
                skippedMissingEmail++;
                continue;
            }
            if (!lead.proposals || lead.proposals.length === 0) {
                skippedMissingProposal++;
                continue;
            }
            try {
                const proposal = lead.proposals[0];
                const info = await this.transporter.sendMail({
                    from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
                    to: lead.email,
                    subject: `Proposal: ${proposal.title} - ${lead.company}`,
                    html: this.brandingService.emailShell(branding, 'Your Security Proposal', `
              <p>Dear ${lead.name},</p>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #111827;">${proposal.title}</h3>
                <p>${proposal.content.replace(/\n/g, '<br/>')}</p>
              </div>
          `),
                });
                await this.prisma.proposal.update({
                    where: { id: proposal.id },
                    data: { status: 'sent' },
                });
                sentCount++;
                results.push({
                    leadId: lead.id,
                    previewUrl: nodemailer.getTestMessageUrl(info),
                });
            }
            catch (error) {
                console.error(`Failed to send email to lead ${lead.id}`, error);
            }
        }
        return {
            sentCount,
            totalLeads: allLeads.length,
            skippedMissingEmail,
            skippedMissingProposal,
            results,
        };
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        branding_service_1.BrandingService])
], EmailService);
//# sourceMappingURL=email.service.js.map