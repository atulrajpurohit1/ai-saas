import { Controller, Get, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('assignments')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('shifts.view')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.assignmentsService.findAll(user.tenantId);
  }
}
