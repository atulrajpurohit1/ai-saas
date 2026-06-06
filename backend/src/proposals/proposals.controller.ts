import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Request, Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  @RequirePermission('proposals.create')
  create(@Req() req: Request, @Body() createProposalDto: CreateProposalDto) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.create(user.tenantId, createProposalDto, user.sub);
  }

  @Get()
  @RequirePermission('proposals.view')
  findAll(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.findAll(user.tenantId);
  }

  @Post('generate')
  @RequirePermission('proposals.create')
  generateProposal(
    @Req() req: Request, 
    @Body('leadId') leadId: string,
    @Body('clientId') clientId?: string
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.generateForLead(user.tenantId, leadId, user.sub, clientId);
  }

  @Post('generate-bulk')
  @RequirePermission('proposals.create')
  generateBulkProposals(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.generateBulkProposals(user.tenantId, user.sub);
  }

  @Get(':id')
  @RequirePermission('proposals.view')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermission('proposals.update')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateProposalDto: UpdateProposalDto,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.update(user.tenantId, id, updateProposalDto, user.sub);
  }

  @Get(':id/export')
  @RequirePermission('proposals.view')
  async export(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const user = req.user as unknown as ActiveUser;
    const buffer = await this.proposalsService.export(user.tenantId, id, user.sub);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=proposal-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    
    res.end(buffer);
  }

  @Get(':id/comments')
  @RequirePermission('proposals.view')
  async getComments(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.getComments(user.tenantId, id);
  }

  @Post(':id/comments')
  @RequirePermission('proposals.update')
  async addComment(
    @Req() req: Request, 
    @Param('id') id: string,
    @Body('content') content: string
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.addComment(user.tenantId, id, user.sub, content);
  }

  @Post(':id/share')
  @RequirePermission('proposals.update')
  async share(
    @Req() req: Request, 
    @Param('id') id: string,
    @Body('clientId') clientId: string
  ) {
    const user = req.user as unknown as ActiveUser;
    const existing = await this.proposalsService.findOne(user.tenantId, id);
    const updateData = existing.status === 'draft' ? { clientId, status: 'sent' } : { clientId };
    const updated = await this.proposalsService.update(user.tenantId, id, updateData, user.sub);
    
    await this.proposalsService.logAction(user.tenantId, user.sub, id, 'DOCUMENT_SHARED', `Proposal shared with client`);
    
    return updated;
  }
}
