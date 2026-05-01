import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(
    @GetUser() user: ActiveUser,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(user.sub, user.tenantId, dto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.clientsService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
  ) {
    return this.clientsService.findOne(user.tenantId, id);
  }

  @Put(':id')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.sub, user.tenantId, id, dto);
  }

  @Post(':id/create-user')
  createUser(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    return this.clientsService.createClientUser(user.tenantId, id, email);
  }
}
