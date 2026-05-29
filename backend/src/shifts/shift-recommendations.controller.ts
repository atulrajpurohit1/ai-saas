import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'scheduler')
export class ShiftRecommendationsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get(':id/recommend-guards')
  recommendGuards(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.shiftsService.recommendGuards(user.sub, user.tenantId, id);
  }
}
