import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard, PermissionGuard, ModuleGuard)
@RequirePermission('shifts.assign')
@RequireModule('GUARD_TOUR')
export class ShiftRecommendationsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get(':id/recommend-guards')
  recommendGuards(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.shiftsService.recommendGuards(user, id);
  }
}
