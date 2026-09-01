import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { RfpService } from './rfp.service';
import { CreateRfpDto } from './dto/create-rfp.dto';
import { UpdateRfpDto } from './dto/update-rfp.dto';
import { AssignVendorsDto } from './dto/assign-vendors.dto';
import { InviteVendorsDto } from './dto/invite-vendors.dto';
import { AwardContractDto } from './dto/award-contract.dto';
import { RejectVendorDto } from './dto/reject-vendor.dto';
import { CreatePerformanceReviewDto } from './dto/create-performance-review.dto';
import { UpdatePerformanceReviewDto } from './dto/update-performance-review.dto';
import { GenerateRfpDto } from '../ai/dto/generate-rfp.dto';
import { GenerateRfpProposalDto } from './dto/generate-rfp-proposal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('rfp')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('rfp.view')
export class RfpController {
  constructor(private readonly rfpService: RfpService) {}

  @Post('generate')
  @RequirePermission('rfp.create')
  generate(@Body() dto: GenerateRfpDto) {
    return this.rfpService.generate(dto);
  }

  @Post()
  @RequirePermission('rfp.create')
  create(@GetUser() user: ActiveUser, @Body() dto: CreateRfpDto) {
    return this.rfpService.create(user.tenantId, user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.rfpService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('rfp.update')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateRfpDto,
  ) {
    return this.rfpService.update(user.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermission('rfp.delete')
  remove(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.remove(user.tenantId, user.sub, id);
  }

  @Get(':id/pdf')
  async exportPdf(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.rfpService.exportPdf(user.tenantId, id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=rfp-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get(':id/vendors')
  findAssignedVendors(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.findAssignedVendors(user.tenantId, id);
  }

  @Post(':id/vendors')
  @RequirePermission('rfp.update')
  assignVendors(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: AssignVendorsDto,
  ) {
    return this.rfpService.assignVendors(
      user.tenantId,
      user.sub,
      id,
      dto.vendorIds,
    );
  }

  @Delete(':id/vendors/:vendorId')
  @RequirePermission('rfp.update')
  removeVendor(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Param('vendorId') vendorId: string,
  ) {
    return this.rfpService.removeVendor(user.tenantId, user.sub, id, vendorId);
  }

  @Post(':id/invite')
  @RequirePermission('rfp.update')
  inviteVendors(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: InviteVendorsDto,
  ) {
    return this.rfpService.inviteVendors(
      user.tenantId,
      user.sub,
      id,
      dto.vendorIds,
    );
  }

  @Get(':id/submissions')
  findSubmissions(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.findSubmissions(user.tenantId, id);
  }

  @Get(':id/submissions/:vendorId/download/:field')
  async downloadSubmissionFile(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Param('vendorId') vendorId: string,
    @Param('field') field: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.rfpService.downloadSubmissionFile(
      user.tenantId,
      id,
      vendorId,
      field,
    );

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  }

  @Post(':id/evaluate')
  @RequirePermission('rfp.evaluate')
  generateEvaluation(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.generateEvaluation(user.tenantId, user.sub, id);
  }

  // --- Phase 3H: security RFP requirement analysis -> grounded proposal ---

  @Get(':id/requirement-analysis')
  getRequirementAnalysis(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
  ) {
    return this.rfpService.getLatestRequirementAnalysis(user.tenantId, id);
  }

  @Post(':id/analyze-requirements')
  @RequirePermission('rfp.evaluate')
  analyzeRequirements(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.analyzeRequirements(user.tenantId, user.sub, id);
  }

  @Post(':id/generate-proposal')
  @RequirePermission('proposals.create')
  generateProposalFromRfp(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: GenerateRfpProposalDto,
  ) {
    return this.rfpService.generateProposalFromRfp(
      user.tenantId,
      user.sub,
      id,
      dto,
    );
  }

  @Post(':id/award')
  @RequirePermission('rfp.award')
  awardContract(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: AwardContractDto,
  ) {
    return this.rfpService.awardContract(
      user.tenantId,
      user.sub,
      id,
      dto.vendorId,
      dto.awardNotes,
    );
  }

  @Post(':id/reject')
  @RequirePermission('rfp.award')
  rejectVendor(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: RejectVendorDto,
  ) {
    return this.rfpService.rejectVendor(
      user.tenantId,
      user.sub,
      id,
      dto.vendorId,
      dto.reason,
    );
  }

  @Get(':id/performance')
  findPerformanceReviews(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.findPerformanceReviews(user.tenantId, id);
  }

  @Post(':id/performance')
  @RequirePermission('vendor.performance')
  createPerformanceReview(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: CreatePerformanceReviewDto,
  ) {
    return this.rfpService.createPerformanceReview(
      user.tenantId,
      user.sub,
      id,
      dto,
    );
  }

  @Patch('performance/:id')
  @RequirePermission('vendor.performance')
  updatePerformanceReview(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdatePerformanceReviewDto,
  ) {
    return this.rfpService.updatePerformanceReview(
      user.tenantId,
      user.sub,
      id,
      dto,
    );
  }
}
