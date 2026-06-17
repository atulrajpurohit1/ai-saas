import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { branchScopedWhere, branchWhere, resolveWriteBranchId } from '../branches/branch-scope';
import { FieldPermissionsService } from '../field-permissions/field-permissions.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { BillingService } from '../billing/billing.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private webhooksService: WebhooksService,
    private fieldPermissionsService: FieldPermissionsService,
    private billingService: BillingService,
  ) {}

  private optionalText(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private sensitiveClientData(dto: CreateClientDto | UpdateClientDto) {
    const billingNotes = dto.billing_notes ?? dto.billingNotes;
    const internalNotes = dto.internal_notes ?? dto.internalNotes;

    return {
      ...(billingNotes !== undefined
        ? { billingNotes: this.optionalText(billingNotes) }
        : {}),
      ...(internalNotes !== undefined
        ? { internalNotes: this.optionalText(internalNotes) }
        : {}),
    };
  }

  async create(user: ActiveUser, dto: CreateClientDto) {
    await this.fieldPermissionsService.assertCanEditFields(user, 'client', dto);

    const branchId = resolveWriteBranchId(user, dto.branch_id);
    const client = await this.prisma.client.create({
      data: {
        name: dto.name,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        ...this.sensitiveClientData(dto),
        tenantId: user.tenantId,
        branchId,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CLIENT_CREATED',
      entityType: 'Client',
      entityId: client.id,
      details: `Client "${client.name}" created`,
    });

    await this.webhooksService.triggerEvent(user.tenantId, 'client.created', { client });

    return this.fieldPermissionsService.filterFieldsByPermission(
      user,
      'client',
      client,
    );
  }

  async findAll(user: ActiveUser, requestedBranchId?: string | null) {
    const clients = await this.prisma.client.findMany({
      where: branchScopedWhere(user, requestedBranchId),
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        billingNotes: true,
        internalNotes: true,
        createdAt: true,
        updatedAt: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
          },
        },
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

    return this.fieldPermissionsService.filterFieldsByPermission(
      user,
      'client',
      clients,
    );
  }

  async findOne(user: ActiveUser, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
          },
        },
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

    return this.fieldPermissionsService.filterFieldsByPermission(
      user,
      'client',
      client,
    );
  }

  async update(user: ActiveUser, id: string, dto: UpdateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    await this.fieldPermissionsService.assertCanEditFields(user, 'client', dto, id);

    const branchId =
      dto.branch_id === undefined
        ? undefined
        : resolveWriteBranchId(user, dto.branch_id);

    const updatedClient = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
        ...this.sensitiveClientData(dto),
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CLIENT_UPDATED',
      entityType: 'Client',
      entityId: client.id,
      details: `Client "${client.name}" updated`,
    });

    return this.fieldPermissionsService.filterFieldsByPermission(
      user,
      'client',
      updatedClient,
    );
  }

  async createClientUser(user: ActiveUser, clientId: string, email: string) {
    await this.billingService.assertCanAddClientUser(user.tenantId);

    // Security check: verify client belongs to tenant
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId, ...branchWhere(user) },
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
          tenantId: user.tenantId,
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
