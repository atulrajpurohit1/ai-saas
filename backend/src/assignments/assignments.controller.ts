import { Controller, Get, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.assignmentsService.findAll(user.tenantId);
  }
}
