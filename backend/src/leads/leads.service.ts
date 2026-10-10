import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { AuditService } from '../audit/audit.service';
import csv from 'csv-parser';
import { format } from 'fast-csv';
import { Readable } from 'stream';
import { AiService } from '../ai/ai.service';
import { AiMeteringService } from '../billing/ai-metering.service';
import { AiFeature } from '@prisma/client';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private auditService: AuditService,
    private aiMetering: AiMeteringService,
  ) {}

  async create(
    createLeadDto: CreateLeadDto,
    tenantId: string,
    userId?: string,
  ) {
    const lead = await this.prisma.lead.create({
      data: {
        ...createLeadDto,
        tenantId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'LEAD',
      entityId: lead.id,
      details: `Created lead for ${lead.company}`,
    });

    return lead;
  }

  async findAll(tenantId: string) {
    return this.prisma.lead.findMany({
      // Converted leads live on as the Deal's linked lead record (Deal.leadId
      // is a required FK), so we don't delete them - we just hide them from
      // the Leads list once they've moved into the pipeline as a deal.
      where: { tenantId, status: { not: 'converted' } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        status: true,
        createdAt: true,
        salesAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            leadScore: true,
            priorityTier: true,
            closeReadinessScore: true,
            discoveryQualityScore: true,
            recommendedNextAction: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead with ID ${id} not found for this tenant`,
      );
    }

    return lead;
  }

  async update(
    id: string,
    updateLeadDto: UpdateLeadDto,
    tenantId: string,
    userId?: string,
  ) {
    await this.findOne(id, tenantId);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: updateLeadDto,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'LEAD',
      entityId: id,
    });

    return lead;
  }

  async updateStatus(
    id: string,
    updateLeadStatusDto: UpdateLeadStatusDto,
    tenantId: string,
    userId?: string,
  ) {
    await this.findOne(id, tenantId);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: { status: updateLeadStatusDto.status },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE_STATUS',
      entityType: 'LEAD',
      entityId: id,
      details: `Status changed to ${updateLeadStatusDto.status}`,
    });

    return lead;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    await this.findOne(id, tenantId);

    await this.prisma.lead.delete({
      where: { id },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'LEAD',
      entityId: id,
    });

    return { success: true };
  }

  async importLeads(
    buffer: Buffer,
    tenantId: string,
  ): Promise<{ count: number }> {
    const results: any[] = [];
    const stream = Readable.from(buffer);

    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          if (data.name && data.company) {
            results.push({
              name: data.name,
              email: data.email || null,
              company: data.company,
              status: data.status || 'new',
              tenantId,
            });
          }
        })
        .on('end', async () => {
          try {
            const created = await this.prisma.lead.createMany({
              data: results,
              skipDuplicates: true,
            });
            resolve({ count: created.count });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => reject(error));
    });
  }

  async exportLeads(tenantId: string): Promise<string> {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId },
      select: {
        name: true,
        email: true,
        company: true,
        status: true,
        createdAt: true,
      },
    });

    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      const csvStream = format({ headers: true });

      csvStream.on('data', (chunk) => chunks.push(chunk));
      csvStream.on('end', () => resolve(Buffer.concat(chunks).toString()));
      csvStream.on('error', (err) => reject(err));

      leads.forEach((lead) => csvStream.write(lead));
      csvStream.end();
    });
  }

  async processPdfLead(buffer: Buffer, tenantId: string) {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    const extractedText = data.text;

    const leadInfo = await this.aiMetering.run(
      { tenantId, feature: AiFeature.LEAD_EXTRACTION },
      () => this.aiService.extractLeadFromText(extractedText),
    );

    return this.prisma.lead.create({
      data: {
        name: leadInfo.name,
        company: leadInfo.company,
        email: leadInfo.email || null,
        status: 'new',
        tenantId,
      },
    });
  }

  async analyzePdf(buffer: Buffer, tenantId: string) {
    // What comes out of here is a prospect's name, email and phone number.
    // Printing the extracted result put that personal data into the
    // production logs in the clear, where anyone with log access could read
    // it -- the same mistake that was already fixed for OTP codes. The
    // logging below records that extraction happened and how big the input
    // was, which is what is actually useful when a PDF fails to parse, and
    // never the contents.
    //
    // Routed through Nest's Logger rather than console so these lines carry
    // a context and level like the rest of the app's output.
    this.logger.log(`Lead PDF analysis started (${buffer.length} bytes)`);
    try {
      const pdfParse = require('pdf-parse');
      // Disable rendering to avoid DOMMatrix/Canvas crashes
      const options = {
        pagerender: () => '',
      };

      const data = await pdfParse(buffer, options);
      this.logger.log(
        `Lead PDF text extracted (${data.text?.length ?? 0} characters)`,
      );

      const leadInfo = await this.aiMetering.run(
        { tenantId, feature: AiFeature.LEAD_EXTRACTION },
        () => this.aiService.extractLeadFromText(data.text),
      );
      this.logger.log('Lead PDF extraction completed');
      return leadInfo;
    } catch (error) {
      // The message, not the whole error: a pdf-parse failure can carry
      // fragments of the document itself in its payload.
      this.logger.error(
        `Lead PDF analysis failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw error;
    }
  }

  async findPotentialDuplicate(
    tenantId: string,
    companyName: string,
    emailDomain?: string | null,
  ) {
    return this.prisma.lead.findFirst({
      where: {
        tenantId,
        OR: [
          { company: { equals: companyName, mode: 'insensitive' } },
          ...(emailDomain
            ? [
                {
                  email: {
                    endsWith: `@${emailDomain}`,
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
