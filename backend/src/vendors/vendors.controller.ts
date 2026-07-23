import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorsService } from './vendors.service';

@Controller('vendors')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('vendors.view')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @RequirePermission('vendors.create')
  create(@GetUser() user: ActiveUser, @Body() dto: CreateVendorDto) {
    return this.vendorsService.create(user.tenantId, user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser, @Query('search') search?: string) {
    return this.vendorsService.findAll(user.tenantId, search);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.vendorsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('vendors.update')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.update(user.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermission('vendors.delete')
  remove(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.vendorsService.remove(user.tenantId, user.sub, id);
  }
}
