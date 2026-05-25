import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.incidentsService.findAllForAdmin(user.tenantId);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.incidentsService.findOneForAdmin(user.tenantId, id, user.sub);
  }
}
