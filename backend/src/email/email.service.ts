import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';

interface SendMailResult {
  messageId: string;
}

/**
 * The product's own name and colour, for mail sent as AegisLead rather than
 * on a tenant's behalf. Kept here, not in BrandingService: branding there is
 * per-tenant and configurable, while this is fixed and is the fallback that
 * applies precisely when no tenant branding should be used.
 */
const PLATFORM_NAME = 'AegisLead';
/** Matches --primary in the app's own stylesheet. */
const PLATFORM_BRAND_COLOR = '#e0221f';

/** A file to send alongside the message, e.g. a report PDF. */
export interface MailAttachment {
  filename: string;
  content: Buffer;
}

interface MailTransport {
  sendMail(options: {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    text: string;
    html: string;
    attachments?: MailAttachment[];
  }): Promise<SendMailResult>;
}

/**
 * Splits an RFC 5322 `"Display Name" <addr@example.com>` string (what
 * senderFor builds, and what SMTP takes directly) into the separate name
 * and email fields that JSON email APIs expect. A bare address with no
 * display name is returned with `name` undefined.
 *
 * A value that is neither form falls through as the whole string in `email`,
 * which the provider then rejects with a generic "valid sender email
 * required". That is a real configuration failure -- a dashboard that strips
 * or HTML-escapes the angle brackets in EMAIL_FROM produces exactly it -- so
 * recoverAddress salvages the address rather than sending a value that cannot
 * work. The caller logs when this fires; see senderFor.
 */
function parseAddress(address: string): { name?: string; email: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(address);
  if (!match) {
    return { email: recoverAddress(address) };
  }
  const name = match[1].trim();
  return { ...(name ? { name } : {}), email: match[2].trim() };
}

/**
 * Last-resort extraction of an address from a malformed EMAIL_FROM. Picks the
 * first token that looks like an address, so "Aegislead atul@example.com" and
 * an HTML-escaped "Aegislead &lt;atul@example.com&gt;" both still send. Returns
 * the trimmed input unchanged when nothing address-shaped is present, leaving
 * the provider to reject it as before.
 */
function recoverAddress(address: string): string {
  // Decode the entities a dashboard may have escaped the brackets into first,
  // so they delimit the address here exactly as raw `<`/`>` would.
  const trimmed = address
    .trim()
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&');
  const found = /[^\s<>"',;:]+@[^\s<>"',;:]+\.[^\s<>"',;:]+/.exec(trimmed);
  return found ? found[0] : trimmed;
}

/**
 * Sends via Brevo's HTTPS REST API rather than their SMTP relay.
 *
 * Render's free tier blocks outbound SMTP ports: connections to
 * smtp-relay.brevo.com:587 (and smtp.resend.com:465 before it) time out
 * after exactly the configured connectionTimeout, while the same host
 * accepts a connection in ~130ms from an unrestricted network. HTTPS is
 * not blocked, so the API is the only workable path on this host.
 *
 * Brevo also only requires a verified sender ADDRESS rather than a
 * verified domain, which is why it is preferred over Resend here.
 */
class BrevoHttpTransport implements MailTransport {
  constructor(private readonly apiKey: string) {}

  async sendMail(options: {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    text: string;
    html: string;
    attachments?: MailAttachment[];
  }): Promise<SendMailResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let response: Response;
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
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Brevo API request failed (${response.status}): ${body || response.statusText}`,
      );
    }

    const data = (await response.json()) as { messageId?: string };
    return { messageId: data.messageId || '' };
  }
}

/**
 * Sends via Resend's plain HTTPS REST API instead of their SMTP relay.
 *
 * The practical advantage is diagnosability: the API returns Resend's real
 * error responses, so an account-level restriction (e.g. 403 "You can only
 * send testing emails to your own email address" when no sending domain is
 * verified) arrives as an actionable message. The SMTP relay surfaced the
 * same condition as an opaque "Connection timeout", which is impossible to
 * tell apart from a network problem.
 */
class ResendHttpTransport implements MailTransport {
  constructor(private readonly apiKey: string) {}

  async sendMail(options: {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    text: string;
    html: string;
    attachments?: MailAttachment[];
  }): Promise<SendMailResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let response: Response;
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
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Resend API request failed (${response.status}): ${body || response.statusText}`,
      );
    }

    const data = (await response.json()) as { id?: string };
    return { messageId: data.id || '' };
  }
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: MailTransport;
  // Set at construction time alongside `transporter` -- see previewUrlFor().
  private usingNodemailer = false;

  // The actual SMTP envelope sender. In production this must be an address
  // on a domain verified with the configured SMTP provider (e.g. Resend) —
  // it is NOT the same as a tenant's arbitrary, admin-editable
  // `branding.support_email`, which is never domain-verified and would be
  // rejected by a provider that enforces sender verification. Falls back to
  // the same placeholder used throughout this service for local/dev
  // (Ethereal accepts any From address).
  // Always a BARE address. senderFor wraps it as `"Company" <addr>`, so a
  // display name here would nest into `"Company" <Name <addr>>` and reach the
  // provider malformed. EMAIL_FROM is operator-supplied and a hosting
  // dashboard may strip or HTML-escape its angle brackets, so normalise once
  // here rather than trusting the shape.
  private readonly envelopeFrom = recoverAddress(
    process.env.EMAIL_FROM || 'no-reply@aisaascrm.com',
  );

  constructor(
    private prisma: PrismaService,
    private brandingService: BrandingService,
  ) {
    // Transport priority: an explicitly-configured HTTP API first, SMTP
    // last. On hosts that block outbound SMTP ports (Render's free tier,
    // where this deploys), SMTP cannot work at all and an HTTP API is the
    // only path -- so a configured API key always wins.
    //
    // Each key is read only from its own variable. In particular this does
    // NOT fall back to SMTP_PASS, which holds the SMTP provider's password
    // (a Brevo *SMTP* key, distinct from a Brevo *API* key): treating that
    // as an API key would send the wrong credential to the wrong endpoint.
    const brevoApiKey = process.env.BREVO_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    // A malformed EMAIL_FROM fails every send with the provider's generic
    // "valid sender email required", which says nothing about the cause. Say
    // it once, loudly, at boot instead of leaving it to be diagnosed one
    // failed password reset at a time.
    const rawFrom = (process.env.EMAIL_FROM || '').trim();
    if (rawFrom && rawFrom !== this.envelopeFrom) {
      this.logger.warn(
        `EMAIL_FROM was normalised from ${JSON.stringify(rawFrom)} to ` +
          `${JSON.stringify(this.envelopeFrom)}. Set it to a bare address ` +
          `(user@example.com) that is verified with the mail provider.`,
      );
    }

    if (brevoApiKey) {
      this.transporter = new BrevoHttpTransport(brevoApiKey);
    } else if (resendApiKey) {
      this.transporter = new ResendHttpTransport(resendApiKey);
    } else {
      const smtpPort = Number(process.env.SMTP_PORT) || 587;

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: smtpPort,
        // Port 465 is implicit TLS (the socket must be TLS from the first
        // byte); every other port (587, 25, ...) is plaintext-then-STARTTLS.
        // nodemailer does NOT infer this from the port when host/port are
        // given explicitly (as here) -- it defaults `secure` to false
        // regardless of port, so without this, port 465 gets a plaintext
        // connection attempt that the server never completes.
        secure: smtpPort === 465,
        auth: {
          user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
          pass: process.env.SMTP_PASS || 'ethereal-pass',
        },
        // nodemailer's defaults (2min connection, 10min socket) let a slow
        // or unresponsive SMTP provider hang a request for minutes. OTP
        // sends are on the synchronous request path (register/login-
        // adjacent), so a failure needs to surface in seconds, not minutes.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
      this.usingNodemailer = true;
    }
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

  /**
   * Ethereal (local/dev fallback) preview link, if this send went through
   * nodemailer's Ethereal transport. `getTestMessageUrl` expects a real
   * nodemailer SentMessageInfo shape (envelope, response, etc.) -- the
   * Resend HTTP path's result is a plain `{ messageId }`, so this is only
   * ever meaningful when `transporter` is the nodemailer instance.
   */
  private previewUrlFor(info: SendMailResult): string | false {
    if (!this.usingNodemailer) {
      return false;
    }
    return nodemailer.getTestMessageUrl(
      info as Parameters<typeof nodemailer.getTestMessageUrl>[0],
    );
  }

  /**
   * Sends a published daily service report to the client, with the PDF
   * attached and the AI-written summary in the body.
   *
   * Returns a result rather than throwing: a delivery failure must never roll
   * back the publish itself. The report is published either way; the caller
   * logs what happened.
   */
  async sendDailyReportEmail(input: {
    tenantId: string;
    to: string;
    cc?: string | null;
    clientName: string;
    siteName: string;
    reportDate: string;
    summary: string;
    pdf: Buffer;
  }): Promise<{ sent: boolean; error?: string }> {
    const branding = await this.brandingService.brandingSnapshot(
      input.tenantId,
    );

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
        text:
          `Daily Service Report\n${input.siteName} — ${input.reportDate}\n\n` +
          `${input.summary}\n\n` +
          `The full report is attached as a PDF.`,
        html: this.brandingService.emailShell(
          branding,
          'Daily Service Report',
          `
          <p>Dear ${input.clientName},</p>
          <p>Please find below the service summary for
            <strong>${input.siteName}</strong> on
            <strong>${input.reportDate}</strong>.</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 20px 0;">
            ${paragraphs
              .map(
                (block) =>
                  `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #4b5563;">${block}</p>`,
              )
              .join('')}
          </div>
          <p style="font-size: 13px; color: #6b7280;">The full report is attached as a PDF.</p>
        `,
        ),
        attachments: [{ filename, content: input.pdf }],
      });

      return { sent: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown mail error';
      this.logger.error(
        `Daily report email to ${input.to} failed: ${message}`,
      );
      return { sent: false, error: message };
    }
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
      previewUrl: this.previewUrlFor(info),
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
      previewUrl: this.previewUrlFor(info),
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
      previewUrl: this.previewUrlFor(info),
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
    return this.platformEmailShell({
      title: 'Reset your password',
      preheader: `Your ${PLATFORM_NAME} password reset code is ${code}. It expires in ${expiresInMinutes} minutes.`,
      bodyHtml: `
        <p style="margin:0 0 16px; font-size:15px; line-height:24px; color:#1f2937;">Hi ${greetingName},</p>
        <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:#1f2937;">
          We received a request to reset the password for your ${companyName} account. Enter this code to choose a new one.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td align="center" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px 16px;">
              <div style="font-family:'SF Mono',Consolas,Menlo,monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:#0f172a; line-height:1;">${code}</div>
              <div style="margin-top:12px; font-size:13px; color:#64748b;">Expires in ${expiresInMinutes} minutes</div>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px; font-size:14px; line-height:22px; color:#475569;">
          For your security, never share this code with anyone. ${companyName} will never ask you for it.
        </p>
        <p style="margin:0; font-size:14px; line-height:22px; color:#64748b;">
          If you didn't request a password reset, you can safely ignore this email - your password will not be changed.
        </p>
      `,
    });
  }

  /**
   * Warns a tenant that their Prospect Search credits are running low, or
   * have run out.
   *
   * Sent to billing contacts rather than to whoever last ran a search: the
   * person who needs to act is the one who can buy credits. Copy differs by
   * tier because the two situations call for different urgency -- LOW is a
   * heads-up that still allows searching, DEPLETED means searches are already
   * being refused.
   */
  async sendCreditBalanceAlertEmail(
    tenantId: string,
    params: {
      recipients: string[];
      tier: 'LOW' | 'DEPLETED';
      balance: number;
      threshold: number;
      purchaseUrl: string;
    },
  ) {
    if (params.recipients.length === 0) {
      throw new Error(
        'sendCreditBalanceAlertEmail requires at least one recipient.',
      );
    }

    const branding = await this.brandingService.brandingSnapshot(tenantId);
    const companyName = branding?.company_name || 'AegisLead';
    const depleted = params.tier === 'DEPLETED';

    const subject = depleted
      ? `Action needed: Prospect Search credits exhausted`
      : `Your Prospect Search credits are running low`;

    const headline = depleted
      ? 'Your Prospect Search credits have run out'
      : 'Your Prospect Search credits are running low';

    const explanation = depleted
      ? `New Prospect Searches are being declined until credits are added. Any search already running will finish normally.`
      : `You have ${params.balance} Prospect Search credit${
          params.balance === 1 ? '' : 's'
        } remaining, which is below your ${params.threshold}-credit alert threshold. Searches still work, but will stop once the balance reaches zero.`;

    const text = `${headline}

${explanation}

Add credits: ${params.purchaseUrl}

You are receiving this because you are a billing contact for ${companyName}.`;

    const bodyHtml = `
      <p style="margin:0 0 16px;">${explanation}</p>
      <p style="margin:0 0 24px;">
        <a href="${params.purchaseUrl}"
           style="display:inline-block;padding:12px 20px;border-radius:6px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;">
          Add credits
        </a>
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        You are receiving this because you are a billing contact for ${companyName}.
      </p>
    `;

    const info = await this.transporter.sendMail({
      ...this.senderFor(companyName, branding?.support_email),
      // Billing contacts are peers, not a disclosure risk to each other, so a
      // single send to all of them is fine and keeps the thread shared.
      to: params.recipients.join(', '),
      subject,
      text,
      html: branding
        ? this.brandingService.emailShell(branding, headline, bodyHtml)
        : `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #111827;"><h2>${headline}</h2>${bodyHtml}</body></html>`,
    });

    return {
      messageId: info.messageId,
      previewUrl: this.previewUrlFor(info),
    };
  }

  /**
   * Notifies a tenant's admins/dispatchers that a guard has triggered a
   * panic/duress alert. Sent on the initial trigger and on every re-send, so a
   * guard who presses the button again actually re-reaches dispatch.
   *
   * Best-effort by contract: the caller records the alert in the database
   * regardless and must not let a mail failure swallow a safety event, so this
   * throws only on a bad call (no recipients), never silently.
   */
  async sendEmergencyAlertEmail(
    tenantId: string,
    params: {
      recipients: string[];
      guardName: string;
      triggeredAt: Date;
      siteName?: string | null;
      branchName?: string | null;
      location?: { latitude: number; longitude: number } | null;
      resent?: boolean;
    },
  ) {
    if (params.recipients.length === 0) {
      throw new Error(
        'sendEmergencyAlertEmail requires at least one recipient.',
      );
    }

    const branding = await this.brandingService.brandingSnapshot(tenantId);
    const companyName = branding?.company_name || 'AegisLead';

    const where =
      [params.siteName, params.branchName].filter(Boolean).join(' - ') ||
      'an unspecified location';
    const when = params.triggeredAt.toLocaleString();
    const mapsUrl = params.location
      ? `https://www.google.com/maps/search/?api=1&query=${params.location.latitude},${params.location.longitude}`
      : null;

    const base = (process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    const alertsUrl = base ? `${base}/emergency-alerts` : null;

    const headline = params.resent
      ? `STILL ACTIVE: ${params.guardName} re-sent an emergency alert`
      : `EMERGENCY: ${params.guardName} triggered an alert`;

    const lines = [
      `${params.guardName} ${params.resent ? 're-sent' : 'triggered'} a panic/duress alert.`,
      `Location: ${where}`,
      `Time: ${when}`,
      ...(mapsUrl ? [`Last known position: ${mapsUrl}`] : []),
      ...(alertsUrl ? ['', `Open the alert: ${alertsUrl}`] : []),
      '',
      `Acknowledge and resolve this from the Emergency Alerts screen in ${companyName}.`,
    ];
    const text = `${headline}\n\n${lines.join('\n')}`;

    const bodyHtml = `
      <p style="margin:0 0 16px;font-weight:600;">${params.guardName} ${
        params.resent ? 're-sent' : 'triggered'
      } a panic/duress alert.</p>
      <p style="margin:0 0 8px;"><strong>Location:</strong> ${where}</p>
      <p style="margin:0 0 8px;"><strong>Time:</strong> ${when}</p>
      ${
        mapsUrl
          ? `<p style="margin:0 0 16px;"><a href="${mapsUrl}">View last known position on the map</a></p>`
          : ''
      }
      ${
        alertsUrl
          ? `<p style="margin:16px 0 24px;">
               <a href="${alertsUrl}"
                  style="display:inline-block;padding:12px 20px;border-radius:6px;background:#b91c1c;color:#ffffff;text-decoration:none;font-weight:600;">
                 Open the alert
               </a>
             </p>`
          : ''
      }
      <p style="margin:0;color:#6b7280;font-size:13px;">
        You are receiving this because you handle safety alerts for ${companyName}.
      </p>
    `;

    const info = await this.transporter.sendMail({
      ...this.senderFor(companyName, branding?.support_email),
      // Dispatchers are peers responding to the same event; a shared send
      // keeps them on one thread.
      to: params.recipients.join(', '),
      subject: headline,
      text,
      html: branding
        ? this.brandingService.emailShell(branding, headline, bodyHtml)
        : `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #111827;"><h2>${headline}</h2>${bodyHtml}</body></html>`,
    });

    return {
      messageId: info.messageId,
      previewUrl: this.previewUrlFor(info),
    };
  }

  /**
   * Internal digest of customers who have outgrown the guard band they pay
   * for. Goes to whoever owns pricing, never to the customer: an underbilled
   * account is a repricing conversation, and this email is the prompt to have
   * it, not the outcome of it.
   *
   * Deliberately unbranded -- it is not a tenant-facing message, and there is
   * no single tenant whose branding would apply to a list spanning several.
   */
  async sendBandDriftDigestEmail(params: {
    recipients: string[];
    rows: {
      tenantName: string;
      tenantId: string;
      packageKey: string;
      fromBand: string;
      toBand: string;
      billableGuards: number;
      currentPrice: number | null;
      correctPrice: number | null;
      shortfall: number | null;
    }[];
    monthlyShortfall: number;
  }) {
    if (params.recipients.length === 0) {
      throw new Error(
        'sendBandDriftDigestEmail requires at least one recipient.',
      );
    }

    const count = params.rows.length;
    const subject = `${count} account${count === 1 ? '' : 's'} have outgrown their guard band (${params.monthlyShortfall}/month)`;
    const headline = 'Guard band review needed';

    const describe = (row: (typeof params.rows)[number]) =>
      `${row.tenantName}: ${row.packageKey} ${row.fromBand} -> ${row.toBand} ` +
      `(${row.billableGuards} billable guards)` +
      (row.shortfall === null
        ? ' - custom quote, price by arrangement'
        : ` - ${row.currentPrice} -> ${row.correctPrice}/month, ${row.shortfall} under`);

    const lines = params.rows.map((row) => `- ${describe(row)}`).join('\n');

    const text = `${headline}

These accounts are billed at a lower guard band than their headcount puts them in. Nothing has been changed: moving an account up a band alters what it is charged, so it needs a person to decide.

${lines}

Total monthly shortfall against list price: ${params.monthlyShortfall}`;

    const bodyHtml = `
      <p style="margin:0 0 16px;">
        These accounts are billed at a lower guard band than their headcount
        puts them in. <strong>Nothing has been changed</strong> &mdash; moving
        an account up a band alters what it is charged, so it needs a person to
        decide.
      </p>
      <ul style="margin:0 0 24px;padding-left:20px;">
        ${params.rows
          .map(
            (row) =>
              `<li style="margin:0 0 8px;">${describe(row)}<br>
                 <span style="color:#6b7280;font-size:12px;">${row.tenantId}</span></li>`,
          )
          .join('')}
      </ul>
      <p style="margin:0 0 24px;">
        Total monthly shortfall against list price:
        <strong>${params.monthlyShortfall}</strong>
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        Sent because BILLING_DRIFT_ALERT_EMAIL lists your address.
      </p>
    `;

    const info = await this.transporter.sendMail({
      ...this.senderFor('AegisLead'),
      to: params.recipients.join(', '),
      subject,
      text,
      html: `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #111827;"><h2>${headline}</h2>${bodyHtml}</body></html>`,
    });

    return {
      messageId: info.messageId,
      previewUrl: this.previewUrlFor(info),
    };
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
    return this.platformEmailShell({
      title: 'Verify your email address',
      preheader: `Your AegisLead verification code is ${code}. It expires in ${expiresInMinutes} minutes.`,
      bodyHtml: `
        <p style="margin:0 0 16px; font-size:15px; line-height:24px; color:#1f2937;">Hi ${greetingName},</p>
        <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:#1f2937;">
          Enter this code to confirm your email address and finish setting up your ${companyName} account.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td align="center" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px 16px;">
              <div style="font-family:'SF Mono',Consolas,Menlo,monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:#0f172a; line-height:1;">${code}</div>
              <div style="margin-top:12px; font-size:13px; color:#64748b;">Expires in ${expiresInMinutes} minutes</div>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px; font-size:14px; line-height:22px; color:#475569;">
          For your security, never share this code with anyone. ${companyName} will never ask you for it.
        </p>
        <p style="margin:0; font-size:14px; line-height:22px; color:#64748b;">
          If you didn't request this, you can safely ignore this email - no account changes have been made.
        </p>
      `,
    });
  }

  /**
   * The product's own email frame, for mail AegisLead sends as itself:
   * account verification, password resets and anything else that is not a
   * tenant speaking to their own customers. Tenant mail keeps going through
   * BrandingService.emailShell with that tenant's logo and colours.
   *
   * Built as nested tables with inline styles because that is what email
   * clients reliably render -- Outlook in particular ignores much of modern
   * CSS, and <style> blocks are stripped by several webmail clients. The
   * preheader is the grey preview line next to the subject in an inbox list;
   * without one, clients pull in whatever text comes first.
   */
  private platformEmailShell(params: {
    title: string;
    preheader: string;
    bodyHtml: string;
  }) {
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${params.title}</title>
  </head>
  <body style="margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${params.preheader}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0;">
            <tr>
              <td style="background:${PLATFORM_BRAND_COLOR}; padding:20px 32px;">
                <div style="font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.3px;">${PLATFORM_NAME}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 20px; font-size:20px; line-height:28px; font-weight:700; color:#0f172a;">${params.title}</h1>
                ${params.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0; padding:20px 32px; background:#f8fafc;">
                <p style="margin:0; font-size:12px; line-height:18px; color:#94a3b8;">
                  &copy; ${year} ${PLATFORM_NAME}. This is an automated message - please don't reply to it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
      previewUrl: this.previewUrlFor(info),
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
      previewUrl: this.previewUrlFor(info),
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
      previewUrl: this.previewUrlFor(info),
    };
  }
}
