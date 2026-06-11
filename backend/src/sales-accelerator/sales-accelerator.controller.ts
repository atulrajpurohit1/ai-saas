import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AnalyzeDiscoveryCallDto } from './dto/analyze-discovery-call.dto';
import { CoachDiscoveryCallDto } from './dto/coach-discovery-call.dto';
import { CreateFollowUpTaskDto } from './dto/create-follow-up-task.dto';
import { GenerateDiscoveryProposalDto } from './dto/generate-discovery-proposal.dto';
import { SaveDiscoveryDto } from './dto/save-discovery.dto';
import { SalesAcceleratorService } from './sales-accelerator.service';

@Controller('sales-accelerator')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SalesAcceleratorController {
  constructor(
    private readonly salesAcceleratorService: SalesAcceleratorService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('ai.view', 'leads.view', 'deals.view')
  getDashboard(@GetUser() user: ActiveUser) {
    return this.salesAcceleratorService.getDashboard(user.tenantId);
  }

  @Get('leads/:leadId')
  @RequireAnyPermission('ai.view', 'leads.view')
  getLeadWorkspace(@Param('leadId') leadId: string, @GetUser() user: ActiveUser) {
    return this.salesAcceleratorService.getLeadWorkspace(user.tenantId, leadId);
  }

  @Get('deals/:dealId')
  @RequireAnyPermission('ai.view', 'deals.view')
  getDealWorkspace(@Param('dealId') dealId: string, @GetUser() user: ActiveUser) {
    return this.salesAcceleratorService.getDealWorkspace(user.tenantId, dealId);
  }

  @Post('leads/:leadId/discovery')
  @RequireAnyPermission('ai.view', 'leads.update')
  saveLeadDiscovery(
    @Param('leadId') leadId: string,
    @Body() dto: SaveDiscoveryDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.saveLeadDiscovery(
      user.tenantId,
      leadId,
      dto,
      user.sub,
    );
  }

  @Post('deals/:dealId/discovery')
  @RequireAnyPermission('ai.view', 'deals.update')
  saveDealDiscovery(
    @Param('dealId') dealId: string,
    @Body() dto: SaveDiscoveryDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.saveDealDiscovery(
      user.tenantId,
      dealId,
      dto,
      user.sub,
    );
  }

  @Post('leads/:leadId/discovery-guide')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'leads.view')
  generateLeadDiscoveryGuide(
    @Param('leadId') leadId: string,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.generateLeadDiscoveryGuide(
      user.tenantId,
      leadId,
      user.sub,
    );
  }

  @Post('deals/:dealId/discovery-guide')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'deals.view')
  generateDealDiscoveryGuide(
    @Param('dealId') dealId: string,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.generateDealDiscoveryGuide(
      user.tenantId,
      dealId,
      user.sub,
    );
  }

  @Post('leads/:leadId/discovery-call')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'leads.view')
  analyzeLeadDiscoveryCall(
    @Param('leadId') leadId: string,
    @Body() dto: AnalyzeDiscoveryCallDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.analyzeLeadDiscoveryCall(
      user.tenantId,
      leadId,
      dto,
      user.sub,
    );
  }

  @Post('deals/:dealId/discovery-call')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'deals.view')
  analyzeDealDiscoveryCall(
    @Param('dealId') dealId: string,
    @Body() dto: AnalyzeDiscoveryCallDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.analyzeDealDiscoveryCall(
      user.tenantId,
      dealId,
      dto,
      user.sub,
    );
  }

  @Post('leads/:leadId/live-coach')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'leads.view')
  coachLeadDiscoveryCall(
    @Param('leadId') leadId: string,
    @Body() dto: CoachDiscoveryCallDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.coachLeadDiscoveryCall(
      user.tenantId,
      leadId,
      dto,
      user.sub,
    );
  }

  @Post('deals/:dealId/live-coach')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'deals.view')
  coachDealDiscoveryCall(
    @Param('dealId') dealId: string,
    @Body() dto: CoachDiscoveryCallDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.coachDealDiscoveryCall(
      user.tenantId,
      dealId,
      dto,
      user.sub,
    );
  }

  @Post('leads/:leadId/outreach')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'leads.view')
  generateLeadOutreach(
    @Param('leadId') leadId: string,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.generateLeadOutreach(
      user.tenantId,
      leadId,
      user.sub,
    );
  }

  @Post('deals/:dealId/outreach')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'deals.view')
  generateDealOutreach(
    @Param('dealId') dealId: string,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.generateDealOutreach(
      user.tenantId,
      dealId,
      user.sub,
    );
  }

  @Post('leads/:leadId/score')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'leads.view')
  scoreLead(@Param('leadId') leadId: string, @GetUser() user: ActiveUser) {
    return this.salesAcceleratorService.scoreLead(
      user.tenantId,
      leadId,
      user.sub,
    );
  }

  @Post('deals/:dealId/score')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'deals.view')
  scoreDeal(@Param('dealId') dealId: string, @GetUser() user: ActiveUser) {
    return this.salesAcceleratorService.scoreDeal(
      user.tenantId,
      dealId,
      user.sub,
    );
  }

  @Post('deals/:dealId/proposal-from-discovery')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('ai.view', 'proposals.create')
  generateProposalFromDiscovery(
    @Param('dealId') dealId: string,
    @Body() dto: GenerateDiscoveryProposalDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.generateProposalFromDiscovery(
      user.tenantId,
      dealId,
      dto,
      user.sub,
    );
  }

  @Post('deals/:dealId/follow-up')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('activities.manage', 'deals.update')
  createDealFollowUp(
    @Param('dealId') dealId: string,
    @Body() dto: CreateFollowUpTaskDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.createDealFollowUp(
      user.tenantId,
      dealId,
      dto,
      user.sub,
    );
  }

  @Post('deals/:dealId/follow-up-sequence')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('activities.manage', 'deals.update')
  createDealFollowUpSequence(
    @Param('dealId') dealId: string,
    @GetUser() user: ActiveUser,
  ) {
    return this.salesAcceleratorService.createDealFollowUpSequence(
      user.tenantId,
      dealId,
      user.sub,
    );
  }
}
