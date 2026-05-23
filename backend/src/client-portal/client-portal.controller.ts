import { BadRequestException, Controller, Get, Post, Param, Body, UseGuards, ForbiddenException, NotFoundException, Response } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AuditService } from '../audit/audit.service';
import { ProposalsService } from '../proposals/proposals.service';
import { Response as ExpressResponse } from 'express';

@Controller('client-portal')
@UseGuards(JwtAuthGuard)
export class ClientPortalController {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private proposalsService: ProposalsService,
  ) {}

  private checkClient(user: ActiveUser) {
    if (user.role !== 'client' || !user.clientId) {
      throw new ForbiddenException('Access denied');
    }
  }

  @Get('proposals')
  async getProposals(@GetUser() user: ActiveUser) {
    this.checkClient(user);

    return this.prisma.proposal.findMany({
      where: { 
        clientId: user.clientId,
        tenantId: user.tenantId 
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('proposals/:id')
  async getProposal(@GetUser() user: ActiveUser, @Param('id') id: string) {
    this.checkClient(user);

    const proposal = await this.prisma.proposal.findFirst({
      where: { 
        id, 
        clientId: user.clientId,
        tenantId: user.tenantId 
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!proposal) throw new NotFoundException('Proposal not found');

    return proposal;
  }

  @Get('proposals/:id/export')
  async exportProposal(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Response() res: ExpressResponse,
  ) {
    this.checkClient(user);

    const buffer = await this.proposalsService.export(
      user.tenantId,
      id,
      user.sub,
      user.clientId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=proposal-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    return res.end(buffer);
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

  @Get('proposals/:id/comments')
  async getComments(@GetUser() user: ActiveUser, @Param('id') id: string) {
    this.checkClient(user);
    await this.getProposal(user, id); // Auth check

    return this.prisma.proposalComment.findMany({
      where: { proposalId: id, tenantId: user.tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('proposals/:id/comments')
  async addComment(
    @GetUser() user: ActiveUser, 
    @Param('id') id: string,
    @Body('content') content: string
  ) {
    this.checkClient(user);
    await this.getProposal(user, id); // Auth check
    const trimmedContent = content?.trim();

    if (!trimmedContent) {
      throw new BadRequestException('Comment content is required');
    }

    const comment = await this.prisma.proposalComment.create({
      data: {
        content: trimmedContent,
        proposalId: id,
        clientUserId: user.sub,
        tenantId: user.tenantId,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'COMMENT_ADDED',
      entityType: 'Proposal',
      entityId: id,
      details: `Client added a comment to proposal`,
    });

    return comment;
  }

  @Get('proposals/:id/timeline')
  async getTimeline(@GetUser() user: ActiveUser, @Param('id') id: string) {
    this.checkClient(user);
    await this.getProposal(user, id); // Auth check

    const documents = await this.prisma.sharedDocument.findMany({
      where: {
        clientId: user.clientId,
        tenantId: user.tenantId,
      },
      select: { id: true },
    });

    const documentIds = documents.map((document) => document.id);
    const timelineFilters = [
      {
        entityId: id,
        entityType: { in: ['Proposal', 'PROPOSAL'] },
        action: { in: ['CREATE', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'COMMENT_ADDED', 'DOCUMENT_SHARED'] },
      },
      ...(documentIds.length > 0
        ? [
            {
              entityId: { in: documentIds },
              entityType: 'Document',
              action: 'DOCUMENT_SHARED',
            },
          ]
        : []),
    ];

    return this.prisma.auditLog.findMany({
      where: { 
        tenantId: user.tenantId,
        OR: timelineFilters,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('documents')
  async getDocuments(@GetUser() user: ActiveUser) {
    this.checkClient(user);

    return this.prisma.sharedDocument.findMany({
      where: { 
        clientId: user.clientId,
        tenantId: user.tenantId 
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('profile')
  async getProfile(@GetUser() user: ActiveUser) {
    this.checkClient(user);

    const client = await this.prisma.client.findFirst({
      where: { id: user.clientId, tenantId: user.tenantId },
    });

    if (!client) throw new NotFoundException('Client profile not found');

    return client;
  }
}
