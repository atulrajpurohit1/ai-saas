import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Roles('admin')
  @Post()
  create(@Req() req: Request, @Body() createProposalDto: CreateProposalDto) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.create(user.tenantId, createProposalDto);
  }

  @Roles('admin')
  @Get()
  findAll(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.findAll(user.tenantId);
  }

  @Roles('admin')
  @Post('generate')
  generateProposal(@Req() req: Request, @Body('leadId') leadId: string) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.generateForLead(user.tenantId, leadId);
  }

  @Roles('admin')
  @Post('generate-bulk')
  generateBulkProposals(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.generateBulkProposals(user.tenantId);
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
    return this.proposalsService.update(user.tenantId, id, updateProposalDto);
  }

  @Roles('admin')
  @Post(':id/duplicate')
  duplicate(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.proposalsService.duplicate(user.tenantId, id);
  }


}
