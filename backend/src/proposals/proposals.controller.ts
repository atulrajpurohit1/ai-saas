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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request, Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Roles('admin')
  @Post()
  create(@Req() req: Request, @Body() createProposalDto: CreateProposalDto) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.create(user.tenantId, createProposalDto, user.sub);
  }

  @Roles('admin')
  @Get()
  findAll(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.findAll(user.tenantId);
  }

  @Roles('admin')
  @Post('generate')
  generateProposal(
    @Req() req: Request, 
    @Body('leadId') leadId: string,
    @Body('clientId') clientId?: string
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.generateForLead(user.tenantId, leadId, user.sub, clientId);
  }

  @Roles('admin')
  @Post('generate-bulk')
  generateBulkProposals(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.generateBulkProposals(user.tenantId, user.sub);
  }

  @Roles('admin')
  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.findOne(user.tenantId, id);
  }

  @Roles('admin')
  @Put(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateProposalDto: UpdateProposalDto,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.update(user.tenantId, id, updateProposalDto, user.sub);
  }

  @Roles('admin')
  @Get(':id/export')
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

  @Roles('admin')
  @Get(':id/comments')
  async getComments(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.getComments(user.tenantId, id);
  }

  @Roles('admin')
  @Post(':id/comments')
  async addComment(
    @Req() req: Request, 
    @Param('id') id: string,
    @Body('content') content: string
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.addComment(user.tenantId, id, user.sub, content);
  }

  @Roles('admin')
  @Post(':id/share')
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
