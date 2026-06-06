import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireAnyPermission, RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @RequirePermission('branches.manage')
  create(@GetUser() user: ActiveUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user, dto);
  }

  @Get()
  @RequireAnyPermission('branches.view', 'shifts.view', 'invoices.view', 'finance.view', 'users.assign_roles')
  findAll(@GetUser() user: ActiveUser) {
    return this.branchesService.findAll(user);
  }

  @Get(':id')
  @RequireAnyPermission('branches.view', 'shifts.view', 'invoices.view', 'finance.view', 'users.assign_roles')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.branchesService.findOne(user, id);
  }

  @Put(':id')
  @RequirePermission('branches.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(user, id, dto);
  }
}
