import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SalesImportsService } from './sales-imports.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('sales-imports')
export class SalesImportsController {
  constructor(private readonly salesImportsService: SalesImportsService) {}

  @Post('preview')
  @RequireAnyPermission('leads.import', 'deals.create')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No CSV file uploaded');
    return this.salesImportsService.preview(file.buffer);
  }

  @Post('commit')
  @RequireAnyPermission('leads.import', 'deals.create')
  @UseInterceptors(FileInterceptor('file'))
  commit(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { target?: string; mapping?: string },
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('No CSV file uploaded');
    const user = req.user as unknown as ActiveUser;
    return this.salesImportsService.commit(file.buffer, body, user.tenantId, user.sub);
  }
}
