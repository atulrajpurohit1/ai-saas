import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { UpdateRateCardDto } from './dto/update-rate-card.dto';
import { RateCardsService } from './rate-cards.service';

@Controller('rate-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class RateCardsController {
  constructor(private readonly rateCardsService: RateCardsService) {}

  @Post()
  create(@GetUser() user: ActiveUser, @Body() dto: CreateRateCardDto) {
    return this.rateCardsService.create(user.tenantId, user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('status') status?: string) {
    return this.rateCardsService.findAll(user.tenantId, status);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rateCardsService.findOne(user.tenantId, id);
  }

  @Put(':id')
  update(@GetUser() user: ActiveUser, @Param('id') id: string, @Body() dto: UpdateRateCardDto) {
    return this.rateCardsService.update(user.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  deactivate(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rateCardsService.deactivate(user.tenantId, user.sub, id);
  }
}
