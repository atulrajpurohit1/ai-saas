import { Controller, Get, Post, Put, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequireAnyPermission, RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @RequirePermission('clients.manage')
  create(
    @GetUser() user: ActiveUser,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(user, dto);
  }

  @Get()
  @RequireAnyPermission('clients.view', 'invoices.generate', 'finance.view')
  findAll(@GetUser() user: ActiveUser, @Query('branch_id') branchId?: string) {
    return this.clientsService.findAll(user, branchId);
  }

  @Get(':id')
  @RequirePermission('clients.view')
  findOne(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
  ) {
    return this.clientsService.findOne(user, id);
  }

  @Put(':id')
  @RequirePermission('clients.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user, id, dto);
  }

  @Post(':id/create-user')
  @RequirePermission('clients.manage')
  createUser(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    return this.clientsService.createClientUser(user, id, email);
  }
}
