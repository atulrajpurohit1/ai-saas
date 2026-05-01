import { Controller, Get, Post, Param, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AuditService } from '../audit/audit.service';

@Controller('client-portal')
@UseGuards(JwtAuthGuard)
export class ClientPortalController {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  @Get('proposals')
  async getProposals(@GetUser() user: ActiveUser) {
    if (user.role !== 'client') throw new ForbiddenException('Access denied');

    return this.prisma.proposal.findMany({
      where: { 
        clientId: (user as any).clientId,
        tenantId: user.tenantId 
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('proposals/:id')
  async getProposal(@GetUser() user: ActiveUser, @Param('id') id: string) {
    if (user.role !== 'client') throw new ForbiddenException('Access denied');

    const proposal = await this.prisma.proposal.findFirst({
      where: { 
        id, 
        clientId: (user as any).clientId,
        tenantId: user.tenantId 
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!proposal) throw new NotFoundException('Proposal not found');

    return proposal;
  }

  @Post('proposals/:id/approve')
  async approveProposal(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const proposal = await this.getProposal(user, id);

    const updated = await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'approved' },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'PROPOSAL_APPROVED',
      entityType: 'Proposal',
      entityId: id,
      details: `Proposal approved by client`,
    });

    return updated;
  }

  @Post('proposals/:id/reject')
  async rejectProposal(@GetUser() user: ActiveUser, @Param('id') id: string) {
    const proposal = await this.getProposal(user, id);

    const updated = await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'rejected' },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'PROPOSAL_REJECTED',
      entityType: 'Proposal',
      entityId: id,
      details: `Proposal rejected by client`,
    });

    return updated;
  }
}
