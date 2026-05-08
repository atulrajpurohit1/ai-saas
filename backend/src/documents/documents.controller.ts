import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Roles('admin')
  @Post()
  create(@Req() req: Request, @Body() data: { name: string, url: string, description?: string, clientId: string }) {
    const user = req.user as unknown as ActiveUser;
    return this.documentsService.create(user.tenantId, user.sub, data);
  }

  @Roles('admin')
  @Get()
  findAll(@Req() req: Request, @Query('clientId') clientId?: string) {
    const user = req.user as unknown as ActiveUser;
    return this.documentsService.findAll(user.tenantId, clientId);
  }

  @Roles('admin')
  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.documentsService.findOne(user.tenantId, id);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.documentsService.remove(user.tenantId, id, user.sub);
  }
}
