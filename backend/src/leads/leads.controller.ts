import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Patch,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  create(@Body() createLeadDto: CreateLeadDto, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.leadsService.create(createLeadDto, user.tenantId);
  }

  @Get()
  findAll(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.leadsService.findAll(user.tenantId);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.leadsService.importLeads(file.buffer, user.tenantId);
  }

  @Post('upload-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('No file uploaded');
    const user = req.user as unknown as ActiveUser;
    return this.leadsService.processPdfLead(file.buffer, user.tenantId);
  }

  @Post('analyze-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async analyzePdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.leadsService.analyzePdf(file.buffer);
  }

  @Get('export')
  async export(@Res() res: Response, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    const csvContent = await this.leadsService.exportLeads(user.tenantId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=leads-export.csv',
    );
    res.status(200).send(csvContent);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.leadsService.findOne(id, user.tenantId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @Req() req: Request,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.leadsService.update(id, updateLeadDto, user.tenantId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateLeadStatusDto: UpdateLeadStatusDto,
    @Req() req: Request,
  ) {
    const user = req.user as unknown as ActiveUser;
    return this.leadsService.updateStatus(id, updateLeadStatusDto, user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.leadsService.remove(id, user.tenantId);
  }
}
