import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { GuardsService } from './guards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';

@Controller('guards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class GuardsController {
  constructor(private readonly guardsService: GuardsService) {}

  @Post()
  create(
    @GetUser() user: ActiveUser,
    @Body() createGuardDto: CreateGuardDto,
  ) {
    return this.guardsService.create(user.sub, user.tenantId, createGuardDto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.guardsService.findAll(user.tenantId);
  }

  @Put(':id')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() updateGuardDto: UpdateGuardDto,
  ) {
    return this.guardsService.update(user.sub, user.tenantId, id, updateGuardDto);
  }
}
