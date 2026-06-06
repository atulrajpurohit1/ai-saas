import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateDocumentDto } from './dto/create-document.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('documents.manage')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Req() req: Request, @Body() data: CreateDocumentDto) {
    const user = req.user as unknown as ActiveUser;
    return this.documentsService.create(user.tenantId, user.sub, data);
  }

  @Get()
  findAll(@Req() req: Request, @Query('clientId') clientId?: string) {
    const user = req.user as unknown as ActiveUser;
    return this.documentsService.findAll(user.tenantId, clientId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.documentsService.findOne(user.tenantId, id);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as unknown as ActiveUser;
    return this.documentsService.remove(user.tenantId, id, user.sub);
  }
}
