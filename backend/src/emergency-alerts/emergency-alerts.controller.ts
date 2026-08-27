import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { EmergencyAlertsService } from './emergency-alerts.service';
import { EmergencyAlertActionDto } from './dto/emergency-alert-action.dto';

// Admin/dispatcher-facing. Reuses the existing incident permissions rather
// than introducing a dedicated panic/duress permission - "view" for seeing
// alerts, "review" (already used for incident review/approval) for taking
// ownership of and closing out a safety event, which is exactly what
// acknowledge/resolve are.
@Controller('emergency-alerts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('incidents.view')
export class EmergencyAlertsController {
  constructor(
    private readonly emergencyAlertsService: EmergencyAlertsService,
  ) {}

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('status') status?: string) {
    return this.emergencyAlertsService.findAllForAdmin(user, status);
  }

  @Post(':id/acknowledge')
  @RequirePermission('incidents.review')
  acknowledge(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: EmergencyAlertActionDto,
  ) {
    return this.emergencyAlertsService.acknowledge(user, id, dto);
  }

  @Post(':id/resolve')
  @RequirePermission('incidents.review')
  resolve(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: EmergencyAlertActionDto,
  ) {
    return this.emergencyAlertsService.resolve(user, id, dto);
  }
}
