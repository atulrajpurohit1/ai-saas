import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import * as bcrypt from 'bcrypt';

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
      include: { users: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
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
    const password = 'client123'; // Default password for testing
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.clientUser.create({
      data: {
        email,
        password: hashedPassword,
        clientId,
        tenantId,
      },
    });
  }
}
