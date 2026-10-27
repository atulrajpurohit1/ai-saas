import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

export type BrandingSnapshot = {
  company_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  login_background: string | null;
  welcome_message: string | null;
  support_email: string | null;
  support_phone: string | null;
};

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getForTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.serializeBranding(tenant);
  }

  async getForUser(user: ActiveUser) {
    return this.getForTenant(user.tenantId);
  }

  async getPublicBranding(input: { domain?: string; tenantSlug?: string }) {
    const domain = this.normalizeDomain(input.domain || '');
    const tenantSlug = input.tenantSlug?.trim().toLowerCase();

    const tenant = domain
      ? await this.prisma.tenant.findFirst({
          where: {
            customDomains: {
              some: {
                domain,
                verificationStatus: 'verified',
              },
            },
          },
          include: { branding: true },
        })
      : tenantSlug
        ? await this.prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            include: { branding: true },
          })
        : null;

    if (!tenant) {
      return this.defaultBranding();
    }

    return this.serializeBranding(tenant);
  }

  async updateBranding(user: ActiveUser, dto: UpdateBrandingDto) {
    const before = await this.getForTenant(user.tenantId);
    const renamedTo = this.nullable(dto.company_name);
    const branding = await this.prisma.tenantBranding.upsert({
      where: { tenantId: user.tenantId },
      update: {
        ...(dto.company_name !== undefined
          ? { companyName: this.nullable(dto.company_name) }
          : {}),
        ...(dto.logo_url !== undefined
          ? { logoUrl: this.nullable(dto.logo_url) }
          : {}),
        ...(dto.favicon_url !== undefined
          ? { faviconUrl: this.nullable(dto.favicon_url) }
          : {}),
        ...(dto.primary_color !== undefined
          ? { primaryColor: dto.primary_color }
          : {}),
        ...(dto.secondary_color !== undefined
          ? { secondaryColor: dto.secondary_color }
          : {}),
        ...(dto.accent_color !== undefined
          ? { accentColor: dto.accent_color }
          : {}),
        ...(dto.login_background !== undefined
          ? { loginBackground: this.nullable(dto.login_background) }
          : {}),
        ...(dto.welcome_message !== undefined
          ? { welcomeMessage: this.nullable(dto.welcome_message) }
          : {}),
        ...(dto.support_email !== undefined
          ? { supportEmail: this.nullable(dto.support_email) }
          : {}),
        ...(dto.support_phone !== undefined
          ? { supportPhone: this.nullable(dto.support_phone) }
          : {}),
      },
      create: {
        tenantId: user.tenantId,
        companyName: this.nullable(dto.company_name),
        logoUrl: this.nullable(dto.logo_url),
        faviconUrl: this.nullable(dto.favicon_url),
        primaryColor: dto.primary_color || '#6366f1',
        secondaryColor: dto.secondary_color || '#334155',
        accentColor: dto.accent_color || '#818cf8',
        loginBackground: this.nullable(dto.login_background),
        welcomeMessage: this.nullable(dto.welcome_message),
        supportEmail: this.nullable(dto.support_email),
        supportPhone: this.nullable(dto.support_phone),
      },
    });

    // The company name is the tenant's name, not a display-only overlay.
    //
    // It used to live only on TenantBranding, so renaming the company changed
    // the platform header and nothing else: the billing page, the super-admin
    // tenant list, the suspend/delete confirmations and the Stripe customer
    // all read Tenant.name and went on showing whatever was typed at signup.
    // One name, one place -- so a rename writes through to the tenant.
    //
    // Only a non-empty name propagates. Clearing the branding field means
    // "fall back to the tenant name" (see serializeBranding), not "erase the
    // tenant name", and Tenant.name is NOT NULL besides.
    if (renamedTo && renamedTo !== before.company_name) {
      await this.prisma.tenant.update({
        where: { id: user.tenantId },
        data: { name: renamedTo },
      });

      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'TENANT_RENAMED',
        entityType: 'Tenant',
        entityId: user.tenantId,
        details:
          `Company name changed from "${before.company_name}" ` +
          `to "${renamedTo}"`,
      });
    }

    const changedLogo = before.logo_url !== branding.logoUrl;
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: changedLogo ? 'BRANDING_LOGO_CHANGED' : 'BRANDING_UPDATED',
      entityType: 'TenantBranding',
      entityId: branding.id,
      details: changedLogo ? 'Tenant logo changed' : 'Tenant branding updated',
    });

    if (
      before.primary_color !== branding.primaryColor ||
      before.secondary_color !== branding.secondaryColor ||
      before.accent_color !== branding.accentColor
    ) {
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'THEME_UPDATED',
        entityType: 'TenantBranding',
        entityId: branding.id,
        details: 'Tenant theme colors updated',
      });
    }

    return this.getForTenant(user.tenantId);
  }

  async listDomains(user: ActiveUser) {
    const domains = await this.prisma.customDomain.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return domains.map((domain) => this.serializeDomain(domain));
  }

  async addDomain(user: ActiveUser, dto: CreateDomainDto) {
    const domain = this.normalizeDomain(dto.domain);
    if (!domain) throw new BadRequestException('domain is required');
    const verificationToken = `ai-saas-${randomBytes(16).toString('hex')}`;

    const created = await this.prisma.customDomain.create({
      data: {
        tenantId: user.tenantId,
        domain,
        verificationToken,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CUSTOM_DOMAIN_ADDED',
      entityType: 'CustomDomain',
      entityId: created.id,
      details: `Domain ${domain} added for verification`,
    });

    return this.serializeDomain(created);
  }

  async verifyDomain(user: ActiveUser, id: string) {
    const domain = await this.prisma.customDomain.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!domain) throw new NotFoundException('Domain not found');

    const verified = await this.hasVerificationTxtRecord(
      domain.domain,
      domain.verificationToken,
    );
    if (!verified) {
      return {
        ...this.serializeDomain(domain),
        verification_error: `Add TXT record _ai-saas.${domain.domain} with value ${domain.verificationToken}`,
      };
    }

    const updated = await this.prisma.customDomain.update({
      where: { id },
      data: {
        verificationStatus: 'verified',
        sslStatus: domain.sslStatus === 'active' ? 'active' : 'provisioning',
        verifiedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CUSTOM_DOMAIN_VERIFIED',
      entityType: 'CustomDomain',
      entityId: updated.id,
      details: `Domain ${updated.domain} verified`,
    });

    return this.serializeDomain(updated);
  }

  async brandingSnapshot(tenantId: string): Promise<BrandingSnapshot> {
    return this.getForTenant(tenantId);
  }

  addPdfHeader(
    doc: any,
    title: string,
    branding: BrandingSnapshot,
    issuerLogoUrl?: string | null,
  ) {
    const primary = this.safeHex(branding.primary_color, '#111827');
    const secondary = this.safeHex(branding.secondary_color, '#4b5563');
    const accent = this.safeHex(branding.accent_color, primary);
    const startY = doc.y;
    const leftX = 50;
    const rightX = 200;
    const rightW = 362; // leftX..562 content area, right block starts at 200

    // Left: the logo image, or — when none is set — the company name as a
    // bold text wordmark, never the old literal "LOGO" placeholder.
    const hasLogo = this.tryAddPdfLogo(
      doc,
      issuerLogoUrl ?? branding.logo_url,
      leftX,
      startY,
      140,
      40,
    );
    let leftBottom = startY + (hasLogo ? 40 : 0);
    if (!hasLogo) {
      doc.font('Helvetica-Bold').fontSize(16).fillColor(primary);
      const nameH = doc.heightOfString(branding.company_name, { width: 140 });
      doc.text(branding.company_name, leftX, startY + 2, { width: 140 });
      leftBottom = startY + 2 + nameH;
    }

    // Right: the document title, then (only when a logo replaced the wordmark)
    // the company name, then contact details — each measured and stacked below
    // the last so a long, wrapping title can never sit on top of the line below
    // it (the old fixed +27/+42 offsets caused exactly that overlap).
    doc.font('Helvetica-Bold').fontSize(20).fillColor(primary);
    const titleH = doc.heightOfString(title, { width: rightW, align: 'right' });
    doc.text(title, rightX, startY, { align: 'right', width: rightW });
    let cursorY = startY + titleH + 3;

    if (hasLogo) {
      doc.font('Helvetica').fontSize(11).fillColor(secondary);
      const cnH = doc.heightOfString(branding.company_name, { width: rightW });
      doc.text(branding.company_name, rightX, cursorY, {
        align: 'right',
        width: rightW,
      });
      cursorY += cnH + 2;
    }

    if (branding.support_email || branding.support_phone) {
      const contact = [branding.support_email, branding.support_phone]
        .filter(Boolean)
        .join(' | ');
      doc.font('Helvetica').fontSize(9).fillColor(secondary);
      const contactH = doc.heightOfString(contact, { width: rightW });
      doc.text(contact, rightX, cursorY, { align: 'right', width: rightW });
      cursorY += contactH;
    }

    // Accent rule sits below whichever side is taller, with a little breathing
    // room, so it never cuts through the title or the wordmark.
    const ruleY = Math.max(leftBottom, cursorY, startY + 40) + 8;
    doc
      .rect(leftX, ruleY, 512, 3)
      .fillColor(accent)
      .fill();

    doc.font('Helvetica').fillColor('#1f2937');
    doc.x = leftX;
    doc.y = ruleY + 14;
  }

  /**
   * Renders a Markdown proposal/report body into a PDFKit document: headings,
   * bold/italic inline runs, bullet and numbered lists, tables, and horizontal
   * rules. Without this, callers dumped the raw Markdown string straight into
   * doc.text(), so clients saw literal "**", "#" and "|" characters in the PDF.
   */
  renderMarkdownBody(doc: any, markdown: string, opts?: { primary?: string }) {
    const primary = this.safeHex(opts?.primary, '#111827');
    const bodyColor = '#1f2937';
    const left = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (!markdown?.trim()) {
      doc.font('Helvetica').fontSize(11).fillColor('#6b7280').text('');
      return;
    }

    const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let i = 0;

    const isTableRow = (l: string) => l.includes('|') && l.trim().length > 0;
    const isTableSeparator = (l: string) =>
      /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes('-') && l.includes('|');

    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();

      if (!trimmed) {
        doc.moveDown(0.4);
        i++;
        continue;
      }

      // Horizontal rule.
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        doc.moveDown(0.25);
        doc
          .moveTo(left, doc.y)
          .lineTo(left + contentWidth, doc.y)
          .strokeColor('#d1d5db')
          .stroke();
        doc.moveDown(0.5);
        i++;
        continue;
      }

      // Table: a row followed by a |---|---| separator.
      if (
        isTableRow(raw) &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1])
      ) {
        const tableLines: string[] = [];
        while (i < lines.length && isTableRow(lines[i]) && lines[i].trim()) {
          tableLines.push(lines[i]);
          i++;
        }
        this.renderMarkdownTable(doc, tableLines, left, contentWidth, primary, bodyColor);
        continue;
      }

      // Headings.
      const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (heading) {
        const level = heading[1].length;
        const size = level === 1 ? 18 : level === 2 ? 15 : level === 3 ? 13 : 12;
        doc.moveDown(level <= 2 ? 0.5 : 0.35);
        this.writeInlineMarkdown(doc, heading[2], {
          baseBold: true,
          size,
          color: primary,
          width: contentWidth,
        });
        doc.moveDown(0.2);
        i++;
        continue;
      }

      // Bullet list.
      const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
      if (bullet) {
        this.writeInlineMarkdown(doc, `•  ${bullet[1]}`, {
          size: 11,
          color: bodyColor,
          width: contentWidth,
          indent: 14,
          lineGap: 2,
        });
        i++;
        continue;
      }

      // Numbered list.
      const numbered = /^(\d+)\.\s+(.*)$/.exec(trimmed);
      if (numbered) {
        this.writeInlineMarkdown(doc, `${numbered[1]}.  ${numbered[2]}`, {
          size: 11,
          color: bodyColor,
          width: contentWidth,
          indent: 14,
          lineGap: 2,
        });
        i++;
        continue;
      }

      // Paragraph.
      doc.moveDown(0.15);
      this.writeInlineMarkdown(doc, trimmed, {
        size: 11,
        color: bodyColor,
        width: contentWidth,
        lineGap: 3,
      });
      i++;
    }

    doc.font('Helvetica').fontSize(11).fillColor(bodyColor);
    doc.x = left;
  }

  /**
   * Writes one line of Markdown inline content, switching PDFKit fonts for
   * **bold** / *italic* runs and flattening links/images/`code` to plain text.
   */
  private writeInlineMarkdown(
    doc: any,
    text: string,
    opts: {
      baseBold?: boolean;
      size: number;
      color: string;
      width: number;
      indent?: number;
      lineGap?: number;
    },
  ) {
    // Drop images, reduce links to their label.
    let s = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

    const runs = this.tokenizeInline(s);
    doc.fontSize(opts.size).fillColor(opts.color);

    const fontFor = (bold: boolean, italic: boolean) => {
      const isBold = bold || opts.baseBold;
      if (isBold && italic) return 'Helvetica-BoldOblique';
      if (isBold) return 'Helvetica-Bold';
      if (italic) return 'Helvetica-Oblique';
      return 'Helvetica';
    };

    if (runs.length === 0) {
      doc.font(fontFor(false, false)).text(s, {
        width: opts.width,
        lineGap: opts.lineGap,
        indent: opts.indent,
        align: 'left',
      });
      return;
    }

    runs.forEach((run, idx) => {
      const isLast = idx === runs.length - 1;
      doc.font(fontFor(run.bold, run.italic)).text(run.text, {
        continued: !isLast,
        width: opts.width,
        lineGap: opts.lineGap,
        indent: idx === 0 ? opts.indent : undefined,
        align: 'left',
      });
    });
  }

  private tokenizeInline(
    s: string,
  ): Array<{ text: string; bold: boolean; italic: boolean }> {
    const runs: Array<{ text: string; bold: boolean; italic: boolean }> = [];
    let bold = false;
    let italic = false;
    let buf = '';
    const flush = () => {
      if (buf) {
        runs.push({ text: buf, bold, italic });
        buf = '';
      }
    };

    for (let i = 0; i < s.length; ) {
      if (s.startsWith('**', i) || s.startsWith('__', i)) {
        flush();
        bold = !bold;
        i += 2;
        continue;
      }
      const ch = s[i];
      if (ch === '*') {
        flush();
        italic = !italic;
        i += 1;
        continue;
      }
      if (ch === '`') {
        // Inline code: keep the text, drop the backticks.
        i += 1;
        continue;
      }
      buf += ch;
      i += 1;
    }
    flush();
    return runs;
  }

  private renderMarkdownTable(
    doc: any,
    tableLines: string[],
    left: number,
    totalWidth: number,
    headerColor: string,
    bodyColor: string,
  ) {
    const rows = tableLines
      .map((l) =>
        l
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim()),
      )
      // Drop the |---|---| separator row.
      .filter(
        (cells) =>
          !cells.every((c) => c === '' || /^:?-{1,}:?$/.test(c)),
      );

    if (rows.length === 0) return;

    const cols = Math.max(...rows.map((r) => r.length));
    const colW = totalWidth / cols;
    const cellPad = 4;
    const bottomMargin = doc.page.height - doc.page.margins.bottom;

    doc.moveDown(0.3);

    rows.forEach((cells, rowIdx) => {
      const isHeader = rowIdx === 0;
      const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';
      const color = isHeader ? headerColor : bodyColor;
      doc.font(font).fontSize(10).fillColor(color);

      const padded: string[] = [];
      for (let c = 0; c < cols; c++) padded.push(cells[c] ?? '');

      const rowH =
        Math.max(
          ...padded.map((t) =>
            doc.heightOfString(t || ' ', { width: colW - cellPad * 2 }),
          ),
          12,
        ) + 8;

      if (doc.y + rowH > bottomMargin) doc.addPage();

      const yStart = doc.y;
      if (isHeader) {
        doc.rect(left, yStart, totalWidth, rowH).fillColor('#f3f4f6').fill();
        doc.font(font).fontSize(10).fillColor(color);
      }

      padded.forEach((t, c) => {
        doc
          .font(font)
          .fontSize(10)
          .fillColor(color)
          .text(t, left + c * colW + cellPad, yStart + 4, {
            width: colW - cellPad * 2,
          });
      });

      doc.y = yStart + rowH;
      doc
        .moveTo(left, doc.y)
        .lineTo(left + totalWidth, doc.y)
        .strokeColor('#e5e7eb')
        .stroke();
    });

    doc.moveDown(0.4);
    doc.font('Helvetica').fillColor(bodyColor);
    doc.x = left;
  }

  emailShell(branding: BrandingSnapshot, title: string, bodyHtml: string) {
    const primary = this.safeHex(branding.primary_color, '#4f46e5');
    const accent = this.safeHex(branding.accent_color, primary);
    const logo = branding.logo_url
      ? `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height:48px; max-width:180px; display:block; margin-bottom:18px;" />`
      : `<div style="font-size:22px; font-weight:800; color:${primary}; margin-bottom:18px;">${branding.company_name}</div>`;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937; background: #ffffff;">
        <div style="border-top: 4px solid ${accent}; padding: 24px 24px 12px;">
          ${logo}
          <h2 style="color: ${primary}; margin: 0;">${title}</h2>
        </div>
        <div style="padding: 8px 24px 24px;">
          ${bodyHtml}
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; color: #6b7280; font-size: 12px;">
          ${branding.support_email ? `Support: ${branding.support_email}` : ''}
          ${branding.support_phone ? `${branding.support_email ? ' | ' : ''}${branding.support_phone}` : ''}
        </div>
      </div>
    `;
  }

  private async hasVerificationTxtRecord(domain: string, token: string) {
    try {
      const records = await dns.resolveTxt(`_ai-saas.${domain}`);
      return records.flat().some((value) => value.trim() === token);
    } catch {
      return false;
    }
  }

  private serializeBranding(tenant: {
    name: string;
    branding?: any | null;
  }): BrandingSnapshot {
    const branding = tenant.branding;
    return {
      company_name: branding?.companyName || tenant.name,
      logo_url: branding?.logoUrl || null,
      favicon_url: branding?.faviconUrl || null,
      primary_color: branding?.primaryColor || '#6366f1',
      secondary_color: branding?.secondaryColor || '#334155',
      accent_color: branding?.accentColor || '#818cf8',
      login_background: branding?.loginBackground || null,
      welcome_message: branding?.welcomeMessage || null,
      support_email: branding?.supportEmail || null,
      support_phone: branding?.supportPhone || null,
    };
  }

  private defaultBranding(): BrandingSnapshot {
    return {
      company_name: 'Ai Saas',
      logo_url: null,
      favicon_url: null,
      primary_color: '#6366f1',
      secondary_color: '#334155',
      accent_color: '#818cf8',
      login_background: null,
      welcome_message: null,
      support_email: null,
      support_phone: null,
    };
  }

  private serializeDomain(domain: any) {
    return {
      id: domain.id,
      tenant_id: domain.tenantId,
      domain: domain.domain,
      verification_status: domain.verificationStatus,
      ssl_status: domain.sslStatus,
      verification_token: domain.verificationToken,
      verification_record: `_ai-saas.${domain.domain}`,
      verified_at: domain.verifiedAt,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
    };
  }

  private normalizeDomain(domain: string) {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');
  }

  private nullable(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  /**
   * Draws the logo image when one is configured. When there is none (or it
   * cannot be decoded) it draws NOTHING and returns false, so the caller can
   * fall back to a text wordmark. It used to stamp a literal "LOGO" into the
   * page, which shipped in every PDF a tenant without a logo generated.
   */
  tryAddPdfLogo(
    doc: any,
    logoUrl: string | null,
    x: number,
    y: number,
    width: number,
    height: number,
  ): boolean {
    if (!logoUrl?.startsWith('data:image/')) {
      return false;
    }

    try {
      const base64 = logoUrl.split(',')[1];
      if (!base64) throw new Error('Missing logo data');
      doc.image(Buffer.from(base64, 'base64'), x, y, { fit: [width, height] });
      return true;
    } catch {
      return false;
    }
  }

  private safeHex(value: string | null | undefined, fallback: string) {
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }
}
