import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  create(@Body() body: any, @GetUser() user: ActiveUser) {
    return this.activitiesService.create({
      ...body,
      tenantId: user.tenantId,
      userId: user.sub,
    });
  }

  @Get()
  findAll(@Query('dealId') dealId: string, @GetUser() user: ActiveUser) {
    return this.activitiesService.findAll(user.tenantId, dealId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @GetUser() user: ActiveUser,
  ) {
    return this.activitiesService.updateStatus(id, status, user.tenantId, user.sub);
  }
}
