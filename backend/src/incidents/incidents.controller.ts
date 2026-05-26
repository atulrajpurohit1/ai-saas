import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ReviewIncidentDto } from './dto/review-incident.dto';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.incidentsService.findAllForAdmin(user.tenantId);
  }

  @Get('review-queue')
  findReviewQueue(@GetUser() user: ActiveUser) {
    return this.incidentsService.findReviewQueueForAdmin(user.tenantId);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.incidentsService.findOneForAdmin(user.tenantId, id, user.sub);
  }

  @Post(':id/review')
  review(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: ReviewIncidentDto,
  ) {
    return this.incidentsService.reviewIncident(user.tenantId, id, user.sub, dto);
  }
}
