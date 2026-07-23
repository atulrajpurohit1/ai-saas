import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { RfpService } from './rfp.service';
import { CreateRfpDto } from './dto/create-rfp.dto';
import { UpdateRfpDto } from './dto/update-rfp.dto';
import { GenerateRfpDto } from '../ai/dto/generate-rfp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('rfp')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('rfp.view')
export class RfpController {
  constructor(private readonly rfpService: RfpService) {}

  @Post('generate')
  @RequirePermission('rfp.create')
  generate(@Body() dto: GenerateRfpDto) {
    return this.rfpService.generate(dto);
  }

  @Post()
  @RequirePermission('rfp.create')
  create(@GetUser() user: ActiveUser, @Body() dto: CreateRfpDto) {
    return this.rfpService.create(user.tenantId, user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user: ActiveUser) {
    return this.rfpService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('rfp.update')
  update(@GetUser() user: ActiveUser, @Param('id') id: string, @Body() dto: UpdateRfpDto) {
    return this.rfpService.update(user.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermission('rfp.delete')
  remove(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.rfpService.remove(user.tenantId, user.sub, id);
  }

  @Get(':id/pdf')
  async exportPdf(@GetUser() user: ActiveUser, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.rfpService.exportPdf(user.tenantId, id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=rfp-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
