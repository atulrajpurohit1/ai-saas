import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CallsService } from './calls.service';
import { LogCallDto } from './dto/log-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard, PermissionGuard, ModuleGuard)
@Controller('calls')
@RequireModule('LEAD_GEN')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post()
  @RequirePermission('calls.create')
  logCall(@Body() dto: LogCallDto, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.logCall(dto, user.tenantId, user.sub);
  }

  @Get()
  @RequirePermission('calls.view')
  findAll(
    @Req() req: Request,
    @Query('leadId') leadId?: string,
    @Query('dealId') dealId?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.findAll(user.tenantId, {
      leadId,
      dealId,
      limit: limit ? parseInt(limit, 10) || undefined : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('calls.view')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('calls.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCallDto,
    @Req() req: Request,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.update(id, dto, user.tenantId, user.sub);
  }

  @Delete(':id')
  @RequirePermission('calls.delete')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.callsService.remove(id, user.tenantId, user.sub);
  }
}
