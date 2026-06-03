import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PredictionEngineService } from './prediction-engine.service';

@Controller('ai-predictions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiPredictionsController {
  constructor(private readonly predictionEngineService: PredictionEngineService) {}

  @Get()
  dashboard(@GetUser() user: ActiveUser) {
    return this.predictionEngineService.getDashboard(user.tenantId, user.sub);
  }
}
