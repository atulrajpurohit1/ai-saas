import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import csv from 'csv-parser';
import { format } from 'fast-csv';
import { Readable } from 'stream';
// pdf-parse is loaded dynamically inside methods to avoid DOMMatrix crash at startup
import { AiService } from '../ai/ai.service';
// Type update trigger 
@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async create(createLeadDto: CreateLeadDto, tenantId: string) {
    return this.prisma.lead.create({
      data: {
        ...createLeadDto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.lead.findMany({
      where: { tenantId },
    });
  }

  async findOne(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead with ID ${id} not found for this tenant`,
      );
    }

    return lead;
  }

  async update(id: string, updateLeadDto: UpdateLeadDto, tenantId: string) {
    // Ensure the lead belongs to the tenant before updating
    await this.findOne(id, tenantId);

    return this.prisma.lead.update({
      where: { id },
      data: updateLeadDto,
    });
  }

  async updateStatus(id: string, updateLeadStatusDto: UpdateLeadStatusDto, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.lead.update({
      where: { id },
      data: { status: updateLeadStatusDto.status },
    });
  }

  async remove(id: string, tenantId: string) {
    // Ensure the lead belongs to the tenant before removing
    await this.findOne(id, tenantId);

    return this.prisma.lead.delete({
      where: { id },
    });
  }

  async importLeads(buffer: Buffer, tenantId: string): Promise<{ count: number }> {
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

    const leadInfo = await this.aiService.extractLeadFromText(extractedText);

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

  async analyzePdf(buffer: Buffer) {
    console.log('PDF: Analysis started, buffer size:', buffer.length);
    try {
      const pdfParse = require('pdf-parse');
      // Disable rendering to avoid DOMMatrix/Canvas crashes
      const options = {
        pagerender: () => '' 
      };
      
      const data = await pdfParse(buffer, options);
      console.log('PDF: Text extracted successfully');
      
      const leadInfo = await this.aiService.extractLeadFromText(data.text);
      console.log('PDF: AI extraction result:', leadInfo);
      return leadInfo;
    } catch (error) {
      console.error('PDF: Analysis failed error:', error);
      throw error;
    }
  }
}
