import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { EmailService } from '../email/email.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { DeleteTenantDto } from './dto/delete-tenant.dto';
import { SuspendTenantDto } from './dto/suspend-tenant.dto';

/** URL-safe slug from a company name, matching the signup flow's shape. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Creating and removing whole tenants, on behalf of the platform owner.
 *
 * This is the one service in the codebase that is allowed to act on a tenant
 * from the outside, which is exactly why it sits behind PlatformAdminGuard and
 * takes a platform admin id rather than an ActiveUser: there is no tenant
 * context to scope it to, and nothing here should ever be reachable from a
 * tenant session.
 */
@Injectable()
export class TenantAdminService {
  private readonly logger = new Logger(TenantAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly email: EmailService,
  ) {}

  /**
   * Creates a tenant and its first owner account.
   *
   * The owner gets `isSuperAdmin: true`, which here means only what it means
   * everywhere in the tenant app: owner of THIS tenant, sees every branch in
   * it. It confers nothing on the platform -- platform authority lives in
   * PlatformAdmin and in a separately-signed token.
   *
   * The account is created already email-verified. A platform admin typing in
   * a customer's details has verified them out of band, and sending an OTP to
   * an address the customer is not expecting mail at would simply strand the
   * account.
   */
  async createTenant(dto: CreateTenantDto, actorId: string) {
    const email = dto.ownerEmail.trim().toLowerCase();
    const name = dto.name.trim();
    const baseSlug = slugify(dto.slug?.trim() || name);

    if (!baseSlug) {
      throw new BadRequestException(
        'Tenant name must contain at least one letter or number.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'A user with that email address already exists.',
      );
    }

    // Slugs are unique platform-wide. Append a counter rather than failing, so
    // two customers with the same trading name can both be onboarded.
    let slug = baseSlug;
    for (let attempt = 2; attempt <= 50; attempt += 1) {
      const taken = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!taken) break;
      slug = `${baseSlug}-${attempt}`;
    }

    const password = await bcrypt.hash(dto.ownerPassword, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name, slug } });

      const owner = await tx.user.create({
        data: {
          email,
          password,
          name: dto.ownerName?.trim() || null,
          tenantId: tenant.id,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          // Tenant-scoped owner rights only. See the class comment.
          isSuperAdmin: true,
        },
      });

      // The founding user is the permanent owner: protected from demotion so
      // the account cannot lock itself out of its own user/role management.
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { ownerUserId: owner.id },
      });

      return { tenant, owner };
    });

    // Outside the transaction: these upsert a fair number of rows and a
    // failure here leaves a usable tenant whose roles get seeded on first
    // login anyway, which is better than rolling back the whole creation.
    await this.roles.ensureTenantSystemRoles(created.tenant.id);
    await this.roles.ensureDefaultAssignmentForUser(created.owner.id);

    this.logger.log(
      `Platform admin ${actorId} created tenant ${created.tenant.id} (${slug}) with owner ${email}`,
    );

    // Same internal "new signup" alert as the self-service path. A super-admin
    // created tenant is already email-verified, so this is the signup event for
    // it. Fire-and-forget: a notification failure must not fail tenant creation.
    void this.email.sendNewSignupNotification({
      companyName: created.tenant.name,
      ownerName: created.owner.name,
      ownerEmail: email,
      source: 'super admin',
    });

    return {
      tenantId: created.tenant.id,
      name: created.tenant.name,
      slug: created.tenant.slug,
      ownerEmail: email,
    };
  }

  /**
   * Reversible removal: blocks every login for the tenant and leaves all of
   * its data in place. Also revokes live sessions, so suspending takes effect
   * now rather than whenever the current access tokens expire.
   */
  async suspendTenant(
    tenantId: string,
    dto: SuspendTenantDto,
    actorId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, isActive: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found.');

    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          isActive: false,
          suspendedAt: new Date(),
          suspendedReason: dto.reason?.trim() || null,
        },
      }),
      this.prisma.userSession.updateMany({
        where: { tenantId, status: 'active' },
        data: { status: 'revoked', revokedAt: new Date() },
      }),
      // Clears the stored refresh tokens so a held refresh token cannot mint a
      // fresh access token for a suspended tenant.
      this.prisma.user.updateMany({
        where: { tenantId },
        data: { refreshToken: null },
      }),
    ]);

    this.logger.warn(
      `Platform admin ${actorId} suspended tenant ${tenantId} (${tenant.name})`,
    );
    return { tenantId, isActive: false };
  }

  /** Undoes a suspension. */
  async reactivateTenant(tenantId: string, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found.');

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: true, suspendedAt: null, suspendedReason: null },
    });

    this.logger.log(
      `Platform admin ${actorId} reactivated tenant ${tenantId} (${tenant.name})`,
    );
    return { tenantId, isActive: true };
  }

  /**
   * Irreversible removal. Deletes the tenant row, which cascades to every
   * table that references it -- users, leads, invoices, shifts, incidents,
   * evidence, credits, the whole account.
   *
   * The caller must echo back the tenant's exact name. That is not UI polish
   * living in the wrong layer: the confirmation has to be checked where the
   * deletion happens, or it is only a dialog that any direct API call skips.
   */
  async deleteTenant(tenantId: string, dto: DeleteTenantDto, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, _count: { select: { users: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found.');

    if (dto.confirmName.trim() !== tenant.name.trim()) {
      throw new BadRequestException(
        'Confirmation does not match the tenant name. Nothing was deleted.',
      );
    }

    // Logged BEFORE the delete: afterwards there is no row left to describe,
    // and this line is the only remaining record that the account existed.
    this.logger.warn(
      `Platform admin ${actorId} is permanently deleting tenant ${tenantId} ` +
        `("${tenant.name}", ${tenant._count.users} users). This cascades to all tenant data.`,
    );

    await this.prisma.tenant.delete({ where: { id: tenantId } });

    return { tenantId, deleted: true, name: tenant.name };
  }
}
