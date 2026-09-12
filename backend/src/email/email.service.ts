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

  // The actual SMTP envelope sender. In production this must be an address
  // on a domain verified with the configured SMTP provider (e.g. Resend) —
  // it is NOT the same as a tenant's arbitrary, admin-editable
  // `branding.support_email`, which is never domain-verified and would be
  // rejected by a provider that enforces sender verification. Falls back to
  // the same placeholder used throughout this service for local/dev
  // (Ethereal accepts any From address).
  private readonly envelopeFrom =
    process.env.EMAIL_FROM || 'no-reply@aisaascrm.com';

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
      // nodemailer's defaults (2min connection, 10min socket) let a slow or
      // unresponsive SMTP provider hang a request for minutes. OTP sends
      // are on the synchronous request path (register/login-adjacent), so
      // a failure needs to surface in seconds, not minutes.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  /**
   * Builds the `from`/`replyTo` pair for an outgoing email. The envelope
   * `from` is always the verified sending address (`EMAIL_FROM`); the
   * tenant's own support email — free text, never domain-verified — is used
   * only as `replyTo` so a recipient who hits "Reply" reaches the tenant's
   * real inbox, without requiring that domain to be verified with the SMTP
   * provider. `emailShell`'s footer already displays the support email as
   * plain text, so this is purely about the SMTP envelope, not what the
   * recipient sees.
   */
  private senderFor(companyName: string, supportEmail?: string | null) {
    return {
      from: `"${companyName}" <${this.envelopeFrom}>`,
      ...(supportEmail ? { replyTo: supportEmail } : {}),
    };
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
      ...this.senderFor(branding.company_name, branding.support_email),
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

  /**
   * Signup email-verification OTP. Deliberately takes only the recipient's
   * email + tenant context (not a user record) so it can be reused for both
   * the admin (`User`) and client-portal (`ClientUser`) signup flows.
   */
  async sendOtpEmail(
    tenantId: string | null,
    params: {
      email: string;
      name?: string | null;
      code: string;
      expiresInMinutes: number;
    },
  ) {
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
        ? this.brandingService.emailShell(
            branding,
            'Verify your email',
            this.otpEmailBody(
              companyName,
              greetingName,
              params.code,
              params.expiresInMinutes,
            ),
          )
        : this.plainOtpEmailHtml(
            companyName,
            greetingName,
            params.code,
            params.expiresInMinutes,
          ),
    });

    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  }

  /**
   * Forgot-password OTP. Same delivery mechanics as sendOtpEmail (SMTP,
   * branding shell, purpose-neutral EmailOtp store upstream) but with
   * password-reset-specific copy so a user can't mistake it for a signup
   * verification email.
   */
  async sendPasswordResetOtpEmail(
    tenantId: string | null,
    params: {
      email: string;
      name?: string | null;
      code: string;
      expiresInMinutes: number;
    },
  ) {
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
        ? this.brandingService.emailShell(
            branding,
            'Password Reset Request',
            this.passwordResetOtpEmailBody(
              companyName,
              greetingName,
              params.code,
              params.expiresInMinutes,
            ),
          )
        : this.plainPasswordResetOtpEmailHtml(
            companyName,
            greetingName,
            params.code,
            params.expiresInMinutes,
          ),
    });

    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  }

  private passwordResetOtpEmailBody(
    companyName: string,
    greetingName: string,
    code: string,
    expiresInMinutes: number,
  ) {
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

  private plainPasswordResetOtpEmailHtml(
    companyName: string,
    greetingName: string,
    code: string,
    expiresInMinutes: number,
  ) {
    return `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #111827;">${this.passwordResetOtpEmailBody(
      companyName,
      greetingName,
      code,
      expiresInMinutes,
    )}</body></html>`;
  }

  private otpEmailBody(
    companyName: string,
    greetingName: string,
    code: string,
    expiresInMinutes: number,
  ) {
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

  private plainOtpEmailHtml(
    companyName: string,
    greetingName: string,
    code: string,
    expiresInMinutes: number,
  ) {
    return `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #111827;">${this.otpEmailBody(
      companyName,
      greetingName,
      code,
      expiresInMinutes,
    )}</body></html>`;
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
      ...this.senderFor(branding.company_name, branding.support_email),
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
      ...this.senderFor(branding.company_name, branding.support_email),
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
      ...this.senderFor(branding.company_name, branding.support_email),
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
}
