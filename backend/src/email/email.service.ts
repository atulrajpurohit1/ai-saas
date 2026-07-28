import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private brandingService: BrandingService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
        pass: process.env.SMTP_PASS || 'ethereal-pass',
      },
    });
  }

  async sendProposalEmail(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      include: {
        proposals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead not found`);
    }

    if (!lead.email) {
      throw new BadRequestException(
        `Lead ${lead.name} does not have an email address`,
      );
    }

    const proposal = lead.proposals[0];
    if (!proposal) {
      throw new BadRequestException(
        `Lead ${lead.name} does not have an associated proposal. Please generate one first.`,
      );
    }

    const branding = await this.brandingService.brandingSnapshot(tenantId);
    const info = await this.transporter.sendMail({
      from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
      to: lead.email,
      subject: `Proposal: ${proposal.title} - ${lead.company}`,
      text: `Dear ${lead.name},\n\nPlease find your security proposal details below:\n\n${proposal.content}`,
      html: this.brandingService.emailShell(
        branding,
        'Your Security Proposal',
        `
          <p>Dear ${lead.name},</p>
          <p>Thank you for choosing <strong>${branding.company_name}</strong>. We have generated a professional security proposal for <strong>${lead.company}</strong>.</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">${proposal.title}</h3>
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #4b5563;">
              ${proposal.content.replace(/\n/g, '<br/>')}
            </div>
          </div>
      `,
      ),
    });

    // Update proposal status to 'sent'
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

  async sendVendorInvitationEmail(
    tenantId: string,
    params: {
      vendorEmail: string;
      vendorCompanyName: string;
      rfpTitle: string;
      dueDate: Date | null;
      invitationUrl: string;
    },
  ) {
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
      html: this.brandingService.emailShell(
        branding,
        'Invitation to Submit a Proposal',
        `
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
        `,
      ),
    });

    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  }

  async sendContractAwardEmail(
    tenantId: string,
    params: {
      vendorEmail: string;
      vendorCompanyName: string;
      rfpTitle: string;
      awardNotes?: string | null;
    },
  ) {
    const branding = await this.brandingService.brandingSnapshot(tenantId);

    const info = await this.transporter.sendMail({
      from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
      to: params.vendorEmail,
      subject: 'Congratulations - Contract Award',
      text: `Dear ${params.vendorCompanyName},\n\nCongratulations! Your proposal for "${params.rfpTitle}" has been selected and the contract has been awarded to your company.${params.awardNotes ? `\n\nNotes: ${params.awardNotes}` : ''}\n\nOur team will be in touch shortly with next steps.`,
      html: this.brandingService.emailShell(
        branding,
        'Congratulations - Contract Award',
        `
          <p>Dear ${params.vendorCompanyName},</p>
          <p><strong>Congratulations!</strong> Your proposal for the following request has been selected, and ${branding.company_name} is pleased to award you the contract.</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">${params.rfpTitle}</h3>
            ${params.awardNotes ? `<p style="color: #4b5563; margin: 0;"><strong>Notes:</strong> ${params.awardNotes}</p>` : ''}
          </div>
          <p>Our team will be in touch shortly with next steps.</p>
        `,
      ),
    });

    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  }

  async sendVendorRejectionEmail(
    tenantId: string,
    params: {
      vendorEmail: string;
      vendorCompanyName: string;
      rfpTitle: string;
      reason?: string | null;
    },
  ) {
    const branding = await this.brandingService.brandingSnapshot(tenantId);

    const info = await this.transporter.sendMail({
      from: `"${branding.company_name}" <${branding.support_email || 'no-reply@aisaascrm.com'}>`,
      to: params.vendorEmail,
      subject: 'Thank you for participating',
      text: `Dear ${params.vendorCompanyName},\n\nThank you for submitting a proposal for "${params.rfpTitle}". After careful review, we have decided to move forward with another vendor at this time.${params.reason ? `\n\nFeedback: ${params.reason}` : ''}\n\nWe appreciate the time and effort you invested in your submission and hope to have the opportunity to work with you in the future.`,
      html: this.brandingService.emailShell(
        branding,
        'Thank you for participating',
        `
          <p>Dear ${params.vendorCompanyName},</p>
          <p>Thank you for submitting a proposal for the following request. After careful review, ${branding.company_name} has decided to move forward with another vendor at this time.</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">${params.rfpTitle}</h3>
            ${params.reason ? `<p style="color: #4b5563; margin: 0;"><strong>Feedback:</strong> ${params.reason}</p>` : ''}
          </div>
          <p>We appreciate the time and effort you invested in your submission and hope to have the opportunity to work with you in the future.</p>
        `,
      ),
    });

    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  }

  async sendBulkProposalEmails(tenantId: string) {
    let sentCount = 0;
    let skippedMissingEmail = 0;
    let skippedMissingProposal = 0;
    const results: any[] = [];
    const branding = await this.brandingService.brandingSnapshot(tenantId);

    // Fetch all leads for the tenant to diagnose
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
          html: this.brandingService.emailShell(
            branding,
            'Your Security Proposal',
            `
              <p>Dear ${lead.name},</p>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #111827;">${proposal.title}</h3>
                <p>${proposal.content.replace(/\n/g, '<br/>')}</p>
              </div>
          `,
          ),
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
      } catch (error) {
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
}
