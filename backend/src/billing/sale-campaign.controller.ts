import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../platform-auth/guards/platform-admin.guard';
import { SaleCampaignService } from './sale-campaign.service';
import { SaleCampaignDto, SetSaleEnabledDto } from './dto/sale-campaign.dto';

@UseGuards(PlatformAdminGuard)
@Controller('platform/sales')
export class SaleCampaignController {
  constructor(private readonly sales: SaleCampaignService) {}

  @Get()
  list() {
    return this.sales.list();
  }

  @Post()
  create(@Body() dto: SaleCampaignDto) {
    return this.sales.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: SaleCampaignDto) {
    return this.sales.update(id, dto);
  }

  @Patch(':id/enabled')
  setEnabled(@Param('id') id: string, @Body() dto: SetSaleEnabledDto) {
    return this.sales.setEnabled(id, dto.enabled);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sales.remove(id);
  }
}
