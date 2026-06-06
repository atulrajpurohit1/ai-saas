import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PredictionEngineService } from './prediction-engine.service';

@Controller('ai-predictions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('ai.manage')
export class AiPredictionsController {
  constructor(private readonly predictionEngineService: PredictionEngineService) {}

  @Get()
  dashboard(@GetUser() user: ActiveUser) {
    return this.predictionEngineService.getDashboard(user.tenantId, user.sub);
  }
}
