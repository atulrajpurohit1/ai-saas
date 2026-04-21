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
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  create(@Body() createDealDto: CreateDealDto, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.create(createDealDto, user.tenantId, user.sub);
  }

  @Post('convert/:leadId')
  convert(@Param('leadId') leadId: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.convertLeadToDeal(leadId, user.tenantId, user.sub);
  }

  @Get()
  findAll(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.findOne(id, user.tenantId);
  }

  @Put(':id/stage')
  updateStage(
    @Param('id') id: string,
    @Body() updateDealStageDto: UpdateDealStageDto,
    @Req() req: Request,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.updateStage(id, updateDealStageDto, user.tenantId, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.dealsService.remove(id, user.tenantId, user.sub);
  }
}
