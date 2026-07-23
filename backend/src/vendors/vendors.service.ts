import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private normalizeServices(value: string[] | undefined) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private async findVendorOrThrow(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async create(
    tenantId: string,
    userId: string | undefined,
    dto: CreateVendorDto,
  ) {
    const vendor = await this.prisma.vendor.create({
      data: {
        tenantId,
        companyName: dto.companyName.trim(),
        contactPerson: dto.contactPerson?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        services: this.normalizeServices(dto.services),
        notes: dto.notes?.trim() || null,
        status: dto.status || 'ACTIVE',
        createdBy: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Vendor',
      entityId: vendor.id,
      details: `Created vendor: ${vendor.companyName}`,
    });

    return vendor;
  }

  async findAll(tenantId: string, search?: string) {
    const trimmedSearch = search?.trim();

    return this.prisma.vendor.findMany({
      where: {
        tenantId,
        ...(trimmedSearch
          ? {
              OR: [
                {
                  companyName: { contains: trimmedSearch, mode: 'insensitive' },
                },
                {
                  contactPerson: {
                    contains: trimmedSearch,
                    mode: 'insensitive',
                  },
                },
                { email: { contains: trimmedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.findVendorOrThrow(tenantId, id);
  }

  async update(
    tenantId: string,
    userId: string | undefined,
    id: string,
    dto: UpdateVendorDto,
  ) {
    await this.findVendorOrThrow(tenantId, id);

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.companyName !== undefined
          ? { companyName: dto.companyName.trim() }
          : {}),
        ...(dto.contactPerson !== undefined
          ? { contactPerson: dto.contactPerson?.trim() || null }
          : {}),
        ...(dto.email !== undefined
          ? { email: dto.email?.trim() || null }
          : {}),
        ...(dto.phone !== undefined
          ? { phone: dto.phone?.trim() || null }
          : {}),
        ...(dto.address !== undefined
          ? { address: dto.address?.trim() || null }
          : {}),
        ...(dto.services !== undefined
          ? { services: this.normalizeServices(dto.services) }
          : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Vendor',
      entityId: id,
      details: `Updated vendor: ${updated.companyName}`,
    });

    return updated;
  }

  async remove(tenantId: string, userId: string | undefined, id: string) {
    const existing = await this.findVendorOrThrow(tenantId, id);

    await this.prisma.vendor.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Vendor',
      entityId: id,
      details: `Deleted vendor: ${existing.companyName}`,
    });

    return { success: true };
  }
}
