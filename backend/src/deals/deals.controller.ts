import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @RequirePermission('deals.create')
  create(@Body() createDealDto: CreateDealDto, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.create(createDealDto, user.tenantId, user.sub);
  }

  @Post('convert/:leadId')
  @RequirePermission('deals.create')
  convert(@Param('leadId') leadId: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.convertLeadToDeal(leadId, user.tenantId, user.sub);
  }

  @Get()
  @RequirePermission('deals.view')
  findAll(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.findAll(user.tenantId);
  }

  @Get(':id')
  @RequirePermission('deals.view')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.findOne(id, user.tenantId);
  }

  @Put(':id/stage')
  @RequirePermission('deals.update')
  updateStage(
    @Param('id') id: string,
    @Body() updateDealStageDto: UpdateDealStageDto,
    @Req() req: Request,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.updateStage(id, updateDealStageDto, user.tenantId, user.sub);
  }

  @Delete(':id')
  @RequirePermission('deals.delete')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.remove(id, user.tenantId, user.sub);
  }
}
