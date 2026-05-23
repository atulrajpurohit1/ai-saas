import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, tenantId: string, dto: CreateClientDto) {
    const client = await this.prisma.client.create({
      data: {
        ...dto,
        tenantId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_CREATED',
      entityType: 'Client',
      entityId: client.id,
      details: `Client "${client.name}" created`,
    });

    return client;
  }

  async findAll(tenantId: string) {
    return this.prisma.client.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(userId: string, tenantId: string, id: string, dto: UpdateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const updatedClient = await this.prisma.client.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_UPDATED',
      entityType: 'Client',
      entityId: client.id,
      details: `Client "${client.name}" updated`,
    });

    return updatedClient;
  }

  async createClientUser(tenantId: string, clientId: string, email: string) {
    // Security check: verify client belongs to tenant
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      include: {
        users: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found in this tenant');
    }

    if (client.users.length > 0) {
      throw new ConflictException('Client portal user already exists for this client');
    }

    const temporaryPassword = randomBytes(12).toString('base64url');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    try {
      const clientUser = await this.prisma.clientUser.create({
        data: {
          email,
          password: hashedPassword,
          clientId,
          tenantId,
        },
      });

      return {
        id: clientUser.id,
        email: clientUser.email,
        clientId: clientUser.clientId,
        temporaryPassword,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'A client portal user with this email already exists.',
        );
      }

      throw error;
    }
  }
}
