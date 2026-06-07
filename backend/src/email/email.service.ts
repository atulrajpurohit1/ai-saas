import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
          orderBy: { createdAt: 'desc' }
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead not found`);
    }

    if (!lead.email) {
      throw new BadRequestException(`Lead ${lead.name} does not have an email address`);
    }

    const proposal = lead.proposals[0];
    if (!proposal) {
      throw new BadRequestException(`Lead ${lead.name} does not have an associated proposal. Please generate one first.`);
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

    // Update proposal status to 'sent'
    await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'sent' }
    });

    return { 
      messageId: info.messageId, 
      previewUrl: nodemailer.getTestMessageUrl(info),
      status: 'sent'
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
      include: { proposals: true }
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
          data: { status: 'sent' }
        });

        sentCount++;
        results.push({ leadId: lead.id, previewUrl: nodemailer.getTestMessageUrl(info) });
      } catch (error) {
        console.error(`Failed to send email to lead ${lead.id}`, error);
      }
    }

    return { 
      sentCount, 
      totalLeads: allLeads.length, 
      skippedMissingEmail, 
      skippedMissingProposal,
      results 
    };
  }
}
